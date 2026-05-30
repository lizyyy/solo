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

export type ChangeType =
  | 'bpm_halfspeed'
  | 'bpm_round'
  | 'key_normalized'
  | 'key_mapped'
  | 'energy_parsed'
  | 'duplicate_merged'
  | 'manual_confirm'
  | 'manual_override'
  | 'field_filled';

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

export const CAMELOT_WHEEL: readonly string[] = [
  '1A', '1B',
  '2A', '2B',
  '3A', '3B',
  '4A', '4B',
  '5A', '5B',
  '6A', '6B',
  '7A', '7B',
  '8A', '8B',
  '9A', '9B',
  '10A', '10B',
  '11A', '11B',
  '12A', '12B',
] as const;

export const CAMELOT_TO_MUSICAL: Record<string, string> = {
  '1A': 'Ab minor', '1B': 'B major',
  '2A': 'Eb minor', '2B': 'F# major',
  '3A': 'Bb minor', '3B': 'Db major',
  '4A': 'F minor', '4B': 'Ab major',
  '5A': 'C minor', '5B': 'Eb major',
  '6A': 'G minor', '6B': 'Bb major',
  '7A': 'D minor', '7B': 'F major',
  '8A': 'A minor', '8B': 'C major',
  '9A': 'E minor', '9B': 'G major',
  '10A': 'B minor', '10B': 'D major',
  '11A': 'F# minor', '11B': 'A major',
  '12A': 'Db minor', '12B': 'E major',
};

export const MUSICAL_TO_CAMELOT: Record<string, string> = Object.fromEntries(
  Object.entries(CAMELOT_TO_MUSICAL).map(([k, v]) => [v.toLowerCase(), k])
);

export const KEY_ALIASES: Record<string, string> = {
  'g#m': 'Ab minor', 'g# minor': 'Ab minor',
  'd#m': 'Eb minor', 'd# minor': 'Eb minor',
  'a#m': 'Bb minor', 'a# minor': 'Bb minor',
  'f#m': 'F# minor', 'f# minor': 'F# minor',
  'c#m': 'Db minor', 'c# minor': 'Db minor',
  'gb': 'F# major', 'gb major': 'F# major',
  'db': 'Db major', 'db major': 'Db major',
  'ab': 'Ab major', 'ab major': 'Ab major',
  'eb': 'Eb major', 'eb major': 'Eb major',
  'bb': 'Bb major', 'bb major': 'Bb major',
  'c#': 'Db major', 'c# major': 'Db major',
};
