import type { ChangeRecord } from './models.js';
export interface KeyNormalizationResult {
    camelot: string | null;
    musical: string | null;
    original: string;
    changed: boolean;
    reason: string;
}
export declare function normalizeKey(rawKey: string | null | undefined): KeyNormalizationResult;
export declare function makeKeyChange(trackId: string, trackTitle: string, trackArtist: string, result: KeyNormalizationResult): ChangeRecord | null;
