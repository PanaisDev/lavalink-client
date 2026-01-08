import type { LavalinkTrack } from "./Track";

/**
 * Audio advertisement track configuration
 */
export interface AdvertisementTrack {
    /** Unique identifier for the advertisement */
    adId: string;
    /** Lavalink encoded track data */
    encoded: string;
    /** Duration in milliseconds */
    duration: number;
    /** Delay in ms before skip is allowed */
    skipDelay?: number;
    /** Custom user data */
    userData?: Record<string, unknown>;
}

/**
 * Advertisement manager options
 */
export interface AdvertisementOptions {
    /** Whether advertisements are enabled for this player */
    enabled: boolean;
    /** Play an ad every N tracks (0 = disabled, 1 = after each track) */
    playEveryNTracks?: number;
}

/**
 * Advertisement manager state
 */
export interface AdvertisementState {
    /** Currently playing advertisement */
    current: AdvertisementTrack | null;
    /** Queue of pending advertisements */
    queue: AdvertisementTrack[];
    /** Whether an ad is currently playing */
    isPlaying: boolean;
    /** Number of tracks since last ad was played */
    tracksSinceLastAd: number;
    /** Timestamp when current ad started */
    startedAt: number | null;
}

/**
 * Advertisement start event payload
 */
export interface AdvertisementStartEvent {
    guildId: string;
    ad: AdvertisementTrack;
}

/**
 * Advertisement end event payload
 */
export interface AdvertisementEndEvent {
    guildId: string;
    ad: AdvertisementTrack;
    reason: "FINISHED" | "SKIPPED" | "ERROR";
}

/**
 * Advertisement skip event payload
 */
export interface AdvertisementSkipEvent {
    guildId: string;
    ad: AdvertisementTrack;
    /** Position in ms when skipped */
    position: number;
}
