import type { Player } from "./Player";
import type { AdvertisementTrack, AdvertisementOptions, AdvertisementState } from "./Types/Advertisement";
import { DebugEvents } from "./Constants";

/**
 * Advertisement Manager for a Player
 * Plays post-roll advertisements (after a track ends)
 */
export class AdvertisementManager {
    /** The associated player */
    public readonly player: Player;

    /** Configuration options */
    private options: AdvertisementOptions = {
        enabled: false,
        volume: 100,
        playEveryNTracks: 0
    };

    /** Current state */
    private state: AdvertisementState = {
        current: null,
        queue: [],
        isPlaying: false,
        tracksSinceLastAd: 0,
        startedAt: null
    };

    /**
     * Create a new Advertisement Manager
     * @param player The parent player
     */
    constructor(player: Player) {
        this.player = player;
    }

    /**
     * Configure the manager options
     * @param options Partial options to apply
     */
    public setOptions(options: Partial<AdvertisementOptions>): this {
        this.options = { ...this.options, ...options };
        return this;
    }

    /**
     * Get the current options
     */
    public getOptions(): AdvertisementOptions {
        return { ...this.options };
    }

    /**
     * Get the current state
     */
    public getState(): AdvertisementState {
        return { ...this.state, queue: [...this.state.queue] };
    }

    /**
     * Add an advertisement to the queue
     * @param ad The advertisement to add
     */
    public queueAd(ad: AdvertisementTrack): this {
        this.state.queue.push(ad);
        this._emitDebugEvent(DebugEvents.AdvertisementQueueAdd, {
            state: "log",
            message: `Advertisement queued: ${ad.adId}`,
            functionLayer: "AdvertisementManager > queueAd()"
        });
        return this;
    }

    /**
     * Clear the advertisement queue
     */
    public clearQueue(): this {
        this.state.queue = [];
        return this;
    }

    /**
     * Get the advertisement queue
     */
    public getQueue(): AdvertisementTrack[] {
        return [...this.state.queue];
    }

    /**
     * Check if an advertisement is currently playing
     */
    public isAdPlaying(): boolean {
        return this.state.isPlaying;
    }

    /**
     * Get the currently playing advertisement
     */
    public getCurrentAd(): AdvertisementTrack | null {
        return this.state.current;
    }

    /**
     * Check if it's time to play an advertisement
     */
    public shouldPlayAd(): boolean {
        if (!this.options.enabled) return false;
        if (this.state.queue.length === 0) return false;
        if (this.options.playEveryNTracks === 0) return false;
        return this.state.tracksSinceLastAd >= this.options.playEveryNTracks;
    }

    /**
     * Increment the track counter
     * @internal Called by the system after each track ends
     */
    public incrementTrackCounter(): void {
        this.state.tracksSinceLastAd++;
    }

    /**
     * Play the next advertisement from the queue
     * @returns true if an ad was played, false otherwise
     */
    public async playNextAd(): Promise<boolean> {
        if (this.state.isPlaying) return false;

        const ad = this.state.queue.shift();
        if (!ad) return false;

        this.state.current = ad;
        this.state.isPlaying = true;
        this.state.startedAt = Date.now();
        this.state.tracksSinceLastAd = 0;

        this._emitDebugEvent(DebugEvents.AdvertisementStart, {
            state: "log",
            message: `Playing advertisement: ${ad.adId}`,
            functionLayer: "AdvertisementManager > playNextAd()"
        });

        try {
            // Save current volume and apply ad volume
            const originalVolume = this.player.volume;
            if (this.options.volume !== undefined && this.options.volume !== originalVolume) {
                await this.player.setVolume(this.options.volume);
            }

            // Play the advertisement
            await this.player.node.updatePlayer({
                guildId: this.player.guildId,
                noReplace: false,
                playerOptions: {
                    track: { encoded: ad.encoded }
                }
            });

            // Emit the start event
            this.player.LavalinkManager.emit("advertisementStart", this.player, ad);

            return true;
        } catch (error) {
            this._emitDebugEvent(DebugEvents.AdvertisementError, {
                state: "error",
                message: `Failed to play advertisement: ${ad.adId}`,
                error: error as Error,
                functionLayer: "AdvertisementManager > playNextAd()"
            });

            this.state.current = null;
            this.state.isPlaying = false;
            this.state.startedAt = null;

            this.player.LavalinkManager.emit("advertisementError", this.player, ad, error);
            return false;
        }
    }

    /**
     * Skip the currently playing advertisement
     */
    public async skipAd(): Promise<this> {
        if (!this.state.isPlaying || !this.state.current) {
            throw new Error("No advertisement is currently playing");
        }

        const ad = this.state.current;

        // Check if skip is allowed
        if (!ad.skippable) {
            throw new Error("This advertisement cannot be skipped");
        }

        // Check skip delay
        if (ad.skipDelay && this.state.startedAt) {
            const elapsed = Date.now() - this.state.startedAt;
            if (elapsed < ad.skipDelay) {
                const remaining = Math.ceil((ad.skipDelay - elapsed) / 1000);
                throw new Error(`Advertisement can be skipped in ${remaining} seconds`);
            }
        }

        this._emitDebugEvent(DebugEvents.AdvertisementSkip, {
            state: "log",
            message: `Skipping advertisement: ${ad.adId}`,
            functionLayer: "AdvertisementManager > skipAd()"
        });

        // Emit the skip event
        this.player.LavalinkManager.emit("advertisementSkip", this.player, ad);

        // End the advertisement
        await this._endCurrentAd("SKIPPED");

        return this;
    }

    /**
     * Called when the advertisement track ends
     * @internal
     */
    public async onAdTrackEnd(reason: "FINISHED" | "ERROR"): Promise<void> {
        if (!this.state.isPlaying || !this.state.current) return;
        await this._endCurrentAd(reason);
    }

    /**
     * End the current advertisement and resume normal playback
     */
    private async _endCurrentAd(reason: "FINISHED" | "SKIPPED" | "ERROR"): Promise<void> {
        const ad = this.state.current;
        if (!ad) return;

        this.state.current = null;
        this.state.isPlaying = false;
        this.state.startedAt = null;

        this._emitDebugEvent(DebugEvents.AdvertisementEnd, {
            state: "log",
            message: `Advertisement ended: ${ad.adId} (${reason})`,
            functionLayer: "AdvertisementManager > _endCurrentAd()"
        });

        // Emit the end event
        this.player.LavalinkManager.emit("advertisementEnd", this.player, ad, reason);

        // Resume queue playback if needed
        if (this.player.queue.tracks.length > 0 || this.player.queue.current) {
            await this.player.play();
        }
    }

    /**
     * Emit a debug event
     */
    private _emitDebugEvent(name: DebugEvents, eventData: { message: string, state: "log" | "warn" | "error", error?: Error | string, functionLayer: string }): void {
        if (!this.player.LavalinkManager.options?.advancedOptions?.enableDebugEvents) return;
        this.player.LavalinkManager.emit("debug", name, eventData);
    }
}
