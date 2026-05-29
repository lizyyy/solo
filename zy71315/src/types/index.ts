export type DataStatus = 'confirmed' | 'tentative';

export type MaterialType = 'steel' | 'aluminum' | 'wood' | 'metal';

export interface TuningFork {
  frequency: number;
  material: 'steel' | 'aluminum';
  status: DataStatus;
}

export interface ResonanceBox {
  length: number;
  width: number;
  height: number;
  material: 'wood' | 'metal';
  status: DataStatus;
}

export interface MicrophonePosition {
  x: number;
  y: number;
  z: number;
  status: DataStatus;
}

export interface SamplingSettings {
  sampleRate: number;
  bitDepth: number;
  fftSize: number;
  status: DataStatus;
}

export interface Peak {
  id: string;
  frequency: number;
  amplitude: number;
  isNoise: boolean;
  status: DataStatus;
  marker?: string;
  width?: number;
  qFactor?: number;
}

export interface SpectrumPoint {
  frequency: number;
  amplitude: number;
}

export interface Experiment {
  id: string;
  name: string;
  status: DataStatus;
  tuningFork: TuningFork;
  resonanceBox: ResonanceBox;
  microphone: MicrophonePosition;
  sampling: SamplingSettings;
  spectrumData: SpectrumPoint[];
  peaks: Peak[];
  noiseMarkers: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  parentId?: string;
}

export interface AppState {
  experiments: Experiment[];
  currentExperimentId: string | null;
  comparisonIds: string[];
  isPlaying: boolean;
  showComparison: boolean;
}

export interface AppActions {
  setCurrentExperiment: (id: string | null) => void;
  addExperiment: (experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateExperiment: (id: string, updates: Partial<Experiment>) => void;
  deleteExperiment: (id: string) => void;
  duplicateExperiment: (id: string) => void;
  toggleComparison: (id: string) => void;
  clearComparison: () => void;
  setIsPlaying: (playing: boolean) => void;
  setShowComparison: (show: boolean) => void;
  updatePeakStatus: (experimentId: string, peakId: string, status: DataStatus) => void;
  markPeakAsNoise: (experimentId: string, peakId: string, isNoise: boolean) => void;
  addNote: (experimentId: string, note: string) => void;
}

export interface ComparisonResult {
  experimentA: Experiment;
  experimentB: Experiment;
  peakFrequencyDiff: { peakA: Peak; peakB: Peak; diff: number }[];
  amplitudeDiff: number;
  correlation: number;
  resonanceEnhancement: number;
}

export type ExportFormat = 'png' | 'pdf' | 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeSpectrum: boolean;
  includePeaks: boolean;
  includeMetadata: boolean;
  resolution?: number;
}

export interface RegressionTestData {
  id: string;
  name: string;
  description: string;
  type: 'noise_misidentification' | 'sample_rate_mismatch' | 'peak_overlap';
  inputData: Partial<Experiment>;
  expectedPeaks: Peak[];
  expectedNoiseCount: number;
}

export interface StatusBadgeConfig {
  key: keyof Experiment | 'peak';
  label: string;
  color: string;
}

export const STATUS_BADGE_CONFIG: StatusBadgeConfig[] = [
  { key: 'tuningFork', label: '音叉频率', color: 'primary' },
  { key: 'resonanceBox', label: '共鸣箱尺寸', color: 'purple' },
  { key: 'microphone', label: '麦克风位置', color: 'accent' },
  { key: 'sampling', label: '采样设置', color: 'primary' },
  { key: 'peak', label: '峰值标记', color: 'status' },
];
