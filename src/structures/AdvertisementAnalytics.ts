/**
 * Represents a single ad impression event
 */
export interface AdImpression {
    /** Advertisement ID */
    adId: string;
    /** Guild ID where ad was played */
    guildId: string;
    /** Timestamp when impression was recorded */
    timestamp: number;
    /** Number of listeners in voice channel */
    listenersCount: number;
    /** Ad duration in milliseconds */
    duration: number;
    /** Whether ad played to completion */
    completed: boolean;
    /** Whether ad was skipped */
    skipped: boolean;
    /** Position in ms where skip occurred (if skipped) */
    skipPosition?: number;
    /** Ad category if available */
    category?: string;
}

/**
 * Aggregated statistics for ad session
 */
export interface AdSessionStats {
    /** Total number of ad impressions */
    totalImpressions: number;
    /** Number of ads that completed playback */
    totalCompletions: number;
    /** Number of ads that were skipped */
    totalSkips: number;
    /** Average listen duration in ms */
    averageListenTime: number;
    /** Completion rate (0-1) */
    completionRate: number;
    /** Impressions grouped by category */
    impressionsByCategory: Record<string, number>;
    /** Total unique guilds reached */
    uniqueGuilds: number;
    /** Total listeners reached */
    totalListenersReached: number;
}

/** Empty stats object */
const EMPTY_STATS: AdSessionStats = {
    totalImpressions: 0,
    totalCompletions: 0,
    totalSkips: 0,
    averageListenTime: 0,
    completionRate: 0,
    impressionsByCategory: {},
    uniqueGuilds: 0,
    totalListenersReached: 0
};

/**
 * Advertisement Analytics Manager
 * Tracks and reports on ad performance
 */
export class AdvertisementAnalytics {
    private impressions: AdImpression[] = [];
    private readonly maxImpressions: number;

    constructor(maxImpressions: number = 10000) {
        this.maxImpressions = maxImpressions;
    }

    /** Record a new ad impression */
    public recordImpression(impression: AdImpression): void {
        this.impressions.push(impression);
        if (this.impressions.length > this.maxImpressions) {
            this.impressions = this.impressions.slice(-this.maxImpressions);
        }
    }

    /** Get all impressions, optionally filtered by time range */
    public getImpressions(timeRange?: { start: number; end: number }): AdImpression[] {
        if (!timeRange) return [...this.impressions];
        return this.impressions.filter(
            imp => imp.timestamp >= timeRange.start && imp.timestamp <= timeRange.end
        );
    }

    /** Get impressions for a specific ad */
    public getImpressionsByAd(adId: string): AdImpression[] {
        return this.impressions.filter(imp => imp.adId === adId);
    }

    /** Get impressions for a specific guild */
    public getImpressionsByGuild(guildId: string): AdImpression[] {
        return this.impressions.filter(imp => imp.guildId === guildId);
    }

    /** Calculate aggregated statistics from impressions */
    private calculateStats(impressions: AdImpression[]): AdSessionStats {
        if (impressions.length === 0) return { ...EMPTY_STATS };

        const completions = impressions.filter(imp => imp.completed).length;
        const skips = impressions.filter(imp => imp.skipped).length;

        const totalListenTime = impressions.reduce((sum, imp) => {
            if (imp.completed) return sum + imp.duration;
            if (imp.skipped && imp.skipPosition) return sum + imp.skipPosition;
            return sum + imp.duration;
        }, 0);

        const byCategory: Record<string, number> = {};
        for (const imp of impressions) {
            const cat = imp.category || 'uncategorized';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        }

        return {
            totalImpressions: impressions.length,
            totalCompletions: completions,
            totalSkips: skips,
            averageListenTime: totalListenTime / impressions.length,
            completionRate: completions / impressions.length,
            impressionsByCategory: byCategory,
            uniqueGuilds: new Set(impressions.map(imp => imp.guildId)).size,
            totalListenersReached: impressions.reduce((sum, imp) => sum + imp.listenersCount, 0)
        };
    }

    /** Get stats, optionally filtered by time range */
    public getStats(timeRange?: { start: number; end: number }): AdSessionStats {
        return this.calculateStats(this.getImpressions(timeRange));
    }

    /** Get stats for a specific ad */
    public getAdStats(adId: string): AdSessionStats {
        return this.calculateStats(this.getImpressionsByAd(adId));
    }

    /** Get stats for a specific guild */
    public getGuildStats(guildId: string): AdSessionStats {
        return this.calculateStats(this.getImpressionsByGuild(guildId));
    }

    /** Export all impressions to JSON */
    public exportToJSON(): string {
        return JSON.stringify({
            exportedAt: Date.now(),
            impressions: this.impressions,
            stats: this.getStats()
        }, null, 2);
    }

    /** Clear all stored impressions */
    public clear(): void {
        this.impressions = [];
    }

    /** Get the number of stored impressions */
    public get count(): number {
        return this.impressions.length;
    }
}
