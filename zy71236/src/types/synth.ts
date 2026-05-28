export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export type LFOTargetType = 'volume' | 'pitch' | 'filter';
export type WarningType = 'out_of_range' | 'clipping' | 'extreme_value' | 'self_oscillation';
export type WarningSeverity = 'low' | 'medium' | 'high';
export type HistoryItemType = 'parameter' | 'preset_load' | 'preset_save' | 'import' | 'warning';
export type SourceType = 'user' | 'import' | 'preset';
export type ValidationErrorType = 'json_parse' | 'missing_field' | 'type_mismatch' | 'out_of_range' | 'logic_conflict';

export interface OscillatorParams {
  waveform: WaveformType;
  frequency: number;
  detune: number;
}

export interface FilterParams {
  type: FilterType;
  cutoff: number;
  resonance: number;
  envelopeAmount: number;
}

export interface EnvelopeParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface LFOParams {
  waveform: WaveformType;
  rate: number;
  depth: number;
  target: LFOTargetType;
}

export interface MasterParams {
  volume: number;
}

export interface SynthParams {
  oscillator: OscillatorParams;
  filter: FilterParams;
  envelope: EnvelopeParams;
  lfo: LFOParams;
  master: MasterParams;
}

export interface Warning {
  type: WarningType;
  message: string;
  timestamp?: number;
  severity: WarningSeverity;
  param: string;
  value: number;
  correctedValue?: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  type: HistoryItemType;
  module: string;
  param: string;
  oldValue: unknown;
  newValue: unknown;
  scoreImpact: {
    dimension: string;
    delta: number;
  } | null;
  warning: Warning | null;
  source: SourceType;
}

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  params: SynthParams;
  description?: string;
}

export interface ScoreStats {
  totalOperations: number;
  warningsCount: number;
  paramsTouched: string[];
  waveformsUsed: string[];
  filterTypesUsed: string[];
  lfoTargetsUsed: string[];
  extremeValueUses: number;
  redundantAdjustments: number;
  startTime: number;
}

export interface Score {
  total: number;
  dimensions: {
    richness: number;
    reasonableness: number;
    fluency: number;
    exploration: number;
    riskControl: number;
  };
  stats: ScoreStats;
}

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  params: SynthParams;
  history: HistoryItem[];
  presets: Preset[];
  currentScore: Score;
}

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  line?: number;
  column?: number;
  field?: string;
  value?: unknown;
  expected?: string;
  actual?: string;
  source?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  correctedParams?: SynthParams;
}

export interface ReportData {
  sessionId: string;
  createdAt: number;
  score: Score;
  finalParams: SynthParams;
  history: HistoryItem[];
  warnings: Warning[];
  presetsSaved: number;
  soundDescription: string;
  recommendations: string[];
}

export interface ParamRange {
  min: number;
  max: number;
  default: number;
  riskThreshold?: number;
  riskThresholdMin?: number;
}

export interface ParamConfig {
  [key: string]: ParamRange | { [key: string]: ParamRange };
}

export const PARAM_RANGES: ParamConfig = {
  oscillator: {
    frequency: { min: 20, max: 20000, default: 440, riskThreshold: 8000 },
    detune: { min: -100, max: 100, default: 0 },
  },
  filter: {
    cutoff: { min: 20, max: 20000, default: 2000, riskThreshold: 18000, riskThresholdMin: 100 },
    resonance: { min: 0, max: 20, default: 1, riskThreshold: 15 },
    envelopeAmount: { min: 0, max: 1, default: 0.5 },
  },
  envelope: {
    attack: { min: 0.001, max: 5, default: 0.01 },
    decay: { min: 0.001, max: 5, default: 0.1 },
    sustain: { min: 0, max: 1, default: 0.7 },
    release: { min: 0.001, max: 10, default: 0.3, riskThreshold: 5 },
  },
  lfo: {
    rate: { min: 0.1, max: 20, default: 5 },
    depth: { min: 0, max: 1, default: 0.3, riskThreshold: 0.8 },
  },
  master: {
    volume: { min: 0, max: 1, default: 0.5, riskThreshold: 0.9 },
  },
};

export const TOTAL_PARAMS_COUNT = 13;

export const DEFAULT_PARAMS: SynthParams = {
  oscillator: {
    waveform: 'sine',
    frequency: 440,
    detune: 0,
  },
  filter: {
    type: 'lowpass',
    cutoff: 2000,
    resonance: 1,
    envelopeAmount: 0.5,
  },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
  },
  lfo: {
    waveform: 'sine',
    rate: 5,
    depth: 0.3,
    target: 'volume',
  },
  master: {
    volume: 0.5,
  },
};

export const INITIAL_SCORE: Score = {
  total: 0,
  dimensions: {
    richness: 0,
    reasonableness: 25,
    fluency: 20,
    exploration: 0,
    riskControl: 10,
  },
  stats: {
    totalOperations: 0,
    warningsCount: 0,
    paramsTouched: [],
    waveformsUsed: ['sine'],
    filterTypesUsed: ['lowpass'],
    lfoTargetsUsed: ['volume'],
    extremeValueUses: 0,
    redundantAdjustments: 0,
    startTime: Date.now(),
  },
};
