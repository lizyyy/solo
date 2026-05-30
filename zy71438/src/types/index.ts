export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface OscillatorConfig {
  id: string;
  enabled: boolean;
  waveform: WaveformType;
  frequency: number;
  volume: number;
  phase: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  targetOscillators: OscillatorConfig[];
  difficulty: 1 | 2 | 3;
  passThreshold: number;
  unlocked: boolean;
  hint?: string;
}

export type OperationType = 
  | 'parameter_change' 
  | 'phase_cancellation' 
  | 'volume_peak' 
  | 'preset_override' 
  | 'playback'
  | 'oscillator_toggle';

export interface OperationLog {
  id: string;
  type: OperationType;
  oscillatorId?: string;
  parameter?: string;
  oldValue?: number | boolean;
  newValue?: number | boolean;
  timestamp: number;
  sequence: number;
  details?: Record<string, any>;
}

export type EvidenceType = 'waveform' | 'oscillator' | 'filter' | 'similarity' | 'audition';

export interface Evidence {
  id: string;
  type: EvidenceType;
  conclusion: string;
  details: Record<string, any>;
  timestamp: number;
  supports?: string;
  conflicts?: string;
}

export interface SimilarityBreakdown {
  waveformMatch: number;
  frequencyMatch: number;
  harmonicMatch: number;
  total: number;
}

export interface Attempt {
  id: string;
  levelId: string;
  playerId: string;
  playerName: string;
  oscillators: OscillatorConfig[];
  score: number;
  similarityBreakdown: SimilarityBreakdown;
  passed: boolean;
  startTime: number;
  endTime: number;
  operationLogs: OperationLog[];
  evidences: Evidence[];
  submissionBatch: string;
  isUpdate: boolean;
  updatedFields: string[];
}

export interface Player {
  id: string;
  nickname: string;
  highScores: Record<string, number>;
}

export interface GameState {
  currentLevel: Level | null;
  oscillators: OscillatorConfig[];
  operationLogs: OperationLog[];
  evidences: Evidence[];
  isPlaying: boolean;
  isTargetPlaying: boolean;
  currentScore: number;
  similarityBreakdown: SimilarityBreakdown;
  startTime: number | null;
  sequenceCounter: number;
  phaseCancellationDetected: boolean;
  volumePeakDetected: boolean;
}

export interface GameActions {
  setCurrentLevel: (level: Level | null) => void;
  setOscillators: (oscillators: OscillatorConfig[]) => void;
  updateOscillator: (id: string, updates: Partial<OscillatorConfig>) => void;
  toggleOscillator: (id: string) => void;
  addOperationLog: (log: Omit<OperationLog, 'id' | 'sequence'>) => void;
  addEvidence: (evidence: Omit<Evidence, 'id'>) => void;
  setPlaying: (playing: boolean) => void;
  setTargetPlaying: (playing: boolean) => void;
  setCurrentScore: (score: number) => void;
  setSimilarityBreakdown: (breakdown: SimilarityBreakdown) => void;
  startGame: () => void;
  resetGame: () => void;
  setPhaseCancellationDetected: (detected: boolean) => void;
  setVolumePeakDetected: (detected: boolean) => void;
}

export interface WaveformData {
  samples: Float32Array;
  sampleRate: number;
}

export type KnobType = 'frequency' | 'volume' | 'phase';
