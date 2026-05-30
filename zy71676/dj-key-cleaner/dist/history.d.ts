import type { HistoryEntry, ChangeRecord } from './models.js';
export declare function recordHistory(basePath: string, sessionId: string, inputFiles: string[], stats: {
    totalInput: number;
    successfullyParsed: number;
    parseErrors: number;
    bpmFixed: number;
    bpmHalfSpeed: number;
    bpmDoubleSpeed: number;
    keysNormalized: number;
    keysFailed: number;
    energyParsed: number;
    energyFailed: number;
    duplicatesFound: number;
    duplicatesMerged: number;
    manualConfirmed: number;
    autoChanges: number;
    manualChanges: number;
    fieldsFilledFromMerge: number;
}, changes: ChangeRecord[]): void;
export declare function checkManualConfirmations(basePath: string, trackId: string, field: string): ChangeRecord | null;
export declare function protectManualOverrides(basePath: string, proposedChanges: ChangeRecord[]): {
    protected: ChangeRecord[];
    overridden: ChangeRecord[];
};
export declare function applyManualConfirmation(basePath: string, trackId: string, trackTitle: string, trackArtist: string, field: string, value: string, reason: string): ChangeRecord;
export declare function getHistory(basePath: string): HistoryEntry[];
export declare function getChangeLogForTrack(basePath: string, trackId: string): ChangeRecord[];
