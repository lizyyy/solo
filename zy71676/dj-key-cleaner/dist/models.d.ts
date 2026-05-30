export interface RawTrack {
    title?: string;
    artist?: string;
    bpm?: string | number;
    key?: string;
    energy?: string | number;
    album?: string;
    genre?: string;
    year?: string | number;
    source?: string;
    [key: string]: unknown;
}
export interface CleanTrack {
    id: string;
    title: string;
    artist: string;
    bpm: number | null;
    keyCamelot: string | null;
    keyMusical: string | null;
    energy: number | null;
    album: string;
    genre: string;
    year: number | null;
    source: string;
    originalBpm: string | number | null;
    originalKey: string | null;
    originalEnergy: string | number | null;
    duplicatesOf: string[];
    manualConfirmed: boolean;
    mergedFrom: string[];
}
export type ChangeType = 'bpm_halfspeed' | 'bpm_round' | 'key_normalized' | 'key_mapped' | 'energy_parsed' | 'duplicate_merged' | 'manual_confirm' | 'manual_override' | 'field_filled';
export interface ChangeRecord {
    trackId: string;
    trackTitle: string;
    trackArtist: string;
    changeType: ChangeType;
    field: string;
    oldValue: string;
    newValue: string;
    reason: string;
    timestamp: string;
    source: 'auto' | 'manual';
    superseded: boolean;
}
export interface ParseWarning {
    rowIndex: number;
    rawLine: string;
    field: string;
    message: string;
    severity: 'error' | 'warn' | 'info';
}
export interface CleaningSession {
    id: string;
    inputFiles: string[];
    timestamp: string;
    totalInputRows: number;
    successfullyParsed: number;
    parseWarnings: ParseWarning[];
    tracks: CleanTrack[];
    changes: ChangeRecord[];
    duplicates: DuplicateGroup[];
    stats: CleaningStats;
}
export interface DuplicateGroup {
    canonicalId: string;
    canonicalTitle: string;
    canonicalArtist: string;
    members: DuplicateMember[];
    mergeStrategy: 'keep_first' | 'keep_richest' | 'manual';
}
export interface DuplicateMember {
    trackId: string;
    title: string;
    artist: string;
    bpm: number | null;
    key: string | null;
    energy: number | null;
    source: string;
    completenessScore: number;
}
export interface CleaningStats {
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
}
export interface HistoryEntry {
    sessionId: string;
    timestamp: string;
    inputFiles: string[];
    summary: CleaningStats;
    changes: ChangeRecord[];
}
export declare const CAMELOT_WHEEL: readonly string[];
export declare const CAMELOT_TO_MUSICAL: Record<string, string>;
export declare const MUSICAL_TO_CAMELOT: Record<string, string>;
export declare const KEY_ALIASES: Record<string, string>;
