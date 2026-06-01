export type PresetStatus = 'draft' | 'confirmed' | 'archived';
export type ComparisonStatus = 'pending' | 'reviewed' | 'approved';
export type DifferenceType = 'changed' | 'added' | 'removed' | 'null' | 'duplicate' | 'boundary';
export type Severity = 'low' | 'medium' | 'high';
export type AnnotationType = 'note' | 'manual-diff';

export interface Oscillator {
  id: string;
  name: string;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  pitch: number;
  fineTune: number;
  level: number;
}

export interface Filter {
  id: string;
  name: string;
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  cutoff: number;
  resonance: number;
  envelopeAmount: number;
}

export interface Envelope {
  id: string;
  name: string;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface LFO {
  id: string;
  name: string;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  rate: number;
  depth: number;
  destination: string;
}

export interface Effect {
  id: string;
  name: string;
  type: 'reverb' | 'delay' | 'distortion' | 'chorus' | 'compressor';
  mix: number;
  parameters: Record<string, number>;
}

export interface PresetParameters {
  oscillators?: Oscillator[];
  filters?: Filter[];
  envelopes?: Envelope[];
  lfos?: LFO[];
  effects?: Effect[];
  [key: string]: any;
}

export interface Preset {
  id: string;
  name: string;
  version: string;
  filename: string;
  operator: string;
  createdAt: number;
  updatedAt: number;
  parameters: PresetParameters;
  status: PresetStatus;
  notes?: string;
}

export interface Difference {
  field: string;
  baseValue: any;
  targetValue: any;
  type: DifferenceType;
  severity: Severity;
}

export interface Comparison {
  id: string;
  basePresetId: string;
  targetPresetId: string;
  differences: Difference[];
  reason: string;
  operator: string;
  createdAt: number;
  status: ComparisonStatus;
}

export interface Annotation {
  id: string;
  comparisonId: string;
  field?: string;
  content: string;
  operator: string;
  createdAt: number;
  type: AnnotationType;
}

export interface ParsedFilename {
  name: string;
  version: string;
  date?: string;
  operator?: string;
}

export interface StoreState {
  presets: Preset[];
  comparisons: Comparison[];
  annotations: Annotation[];
  currentOperator: string;
  activeComparisonId: string | null;
}

export interface StoreActions {
  addPreset: (preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  createComparison: (basePresetId: string, targetPresetId: string, reason: string) => Comparison;
  updateComparison: (id: string, updates: Partial<Comparison>) => void;
  deleteComparison: (id: string) => void;
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setActiveComparison: (id: string | null) => void;
  setCurrentOperator: (name: string) => void;
  loadSampleData: () => void;
  clearAllData: () => void;
}

export type PresetStore = StoreState & StoreActions;

export const DIFFERENCE_TYPE_LABELS: Record<DifferenceType, string> = {
  changed: '值变更',
  added: '新增字段',
  removed: '删除字段',
  null: '空值',
  duplicate: '重复项',
  boundary: '边界记录',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  low: 'text-accent-neon',
  medium: 'text-accent-amber',
  high: 'text-accent-coral',
};

export const SEVERITY_BG_COLORS: Record<Severity, string> = {
  low: 'bg-accent-neon/20 border-accent-neon/50',
  medium: 'bg-accent-amber/20 border-accent-amber/50',
  high: 'bg-accent-coral/20 border-accent-coral/50',
};
