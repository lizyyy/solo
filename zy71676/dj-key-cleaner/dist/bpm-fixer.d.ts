import type { ChangeRecord } from './models.js';
export interface BpmFixResult {
    originalBpm: number | null;
    fixedBpm: number | null;
    isHalfSpeed: boolean;
    isDoubleSpeed: boolean;
    wasRounded: boolean;
    reason: string;
}
export declare function detectBpmFix(rawBpm: string | number | undefined | null, key?: string | null, genre?: string | null): BpmFixResult;
export declare function makeBpmChange(trackId: string, trackTitle: string, trackArtist: string, result: BpmFixResult): ChangeRecord | null;
