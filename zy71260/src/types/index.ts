export type DataQuality = 'normal' | 'borderline' | 'error';

export type ModeType = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';

export type ChordFunction = 'tonic' | 'supertonic' | 'mediant' | 'subdominant' | 'dominant' | 'submediant' | 'leading';

export type ModulationType = 'direct' | 'pivot' | 'sequential' | 'enharmonic';

export interface DataSource {
  id: string;
  name: string;
  type: 'textbook' | 'score' | 'recording' | 'analysis';
  processingStage: 'raw' | 'validated' | 'cleaned' | 'final';
  processingOrder: number;
  url?: string;
  notes?: string;
}

export interface ValidationResult {
  isValid: boolean;
  checks: {
    enharmonicConfusion: boolean;
    audioMismatch: boolean;
    brokenPath: boolean;
    invalidInterval: boolean;
  };
  warnings: string[];
  errors: string[];
}

export interface Mode {
  id: string;
  name: string;
  type: ModeType;
  rootNote: string;
  fifthsPosition: number;
  functionLevel: number;
  brightness: number;
  color: string;
  quality: DataQuality;
  sourceId: string;
  audioSampleId?: string;
  validation: ValidationResult;
  position: { x: number; y: number; z: number };
}

export interface Chord {
  id: string;
  name: string;
  symbol: string;
  function: ChordFunction;
  modeId: string;
  quality: DataQuality;
  sourceId: string;
  audioSampleId?: string;
  position: { x: number; y: number; z: number };
}

export interface ModulationPath {
  id: string;
  fromModeId: string;
  toModeId: string;
  type: ModulationType;
  isBroken: boolean;
  pivotChords?: string[];
  quality: DataQuality;
  sourceId: string;
}

export interface AudioSample {
  id: string;
  targetId: string;
  targetType: 'mode' | 'chord' | 'progression';
  notes: string[];
  isMismatched: boolean;
  quality: DataQuality;
  sourceId: string;
}

export interface FilterState {
  modeTypes: ModeType[];
  chordFunctions: ChordFunction[];
  modulationTypes: ModulationType[];
  dataQualities: DataQuality[];
  showBrokenPaths: boolean;
  showMismatchedAudio: boolean;
}

export interface AppState {
  modes: Mode[];
  chords: Chord[];
  modulationPaths: ModulationPath[];
  audioSamples: AudioSample[];
  dataSources: DataSource[];
  selectedModeId: string | null;
  selectedChordId: string | null;
  highlightedPathId: string | null;
  filters: FilterState;
  isPlaying: boolean;
  currentAudioId: string | null;
  autoRotate: boolean;
}

export interface AppActions {
  setSelectedMode: (id: string | null) => void;
  setSelectedChord: (id: string | null) => void;
  setHighlightedPath: (id: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  toggleModeType: (type: ModeType) => void;
  toggleChordFunction: (func: ChordFunction) => void;
  toggleModulationType: (type: ModulationType) => void;
  toggleDataQuality: (quality: DataQuality) => void;
  setShowBrokenPaths: (show: boolean) => void;
  setShowMismatchedAudio: (show: boolean) => void;
  setPlaying: (playing: boolean, audioId?: string | null) => void;
  setAutoRotate: (auto: boolean) => void;
  resetFilters: () => void;
}

export type AppStore = AppState & AppActions;

export const QUALITY_COLORS: Record<DataQuality, string> = {
  normal: '#2ecc71',
  borderline: '#f39c12',
  error: '#e74c3c',
};

export const MODE_TYPE_COLORS: Record<ModeType, string> = {
  major: '#ffd700',
  minor: '#9b59b6',
  dorian: '#3498db',
  phrygian: '#e74c3c',
  lydian: '#2ecc71',
  mixolydian: '#f39c12',
  aeolian: '#1abc9c',
  locrian: '#95a5a6',
};

export const MODULATION_TYPE_COLORS: Record<ModulationType, string> = {
  direct: '#00d4ff',
  pivot: '#ff6b6b',
  sequential: '#4ecdc4',
  enharmonic: '#ffe66d',
};

export const CHORD_FUNCTION_COLORS: Record<ChordFunction, string> = {
  tonic: '#ffd700',
  supertonic: '#9b59b6',
  mediant: '#3498db',
  subdominant: '#2ecc71',
  dominant: '#e74c3c',
  submediant: '#f39c12',
  leading: '#1abc9c',
};
