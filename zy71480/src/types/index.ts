export interface Speaker {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  power: number;
  delay: number;
  angle: number;
  source: string;
  version: string;
}

export interface MeasurePoint {
  id: string;
  x: number;
  y: number;
}

export interface IntermediateValue {
  speakerId: string;
  speakerName: string;
  distance: number;
  spl: number;
  intensity: number;
  travelTime: number;
  totalTime: number;
}

export interface PhaseIntermediate {
  speakerId1: string;
  speakerName1: string;
  speakerId2: string;
  speakerName2: string;
  timeDiff: number;
  phaseDiff: number;
  cancelFactor: number;
}

export type ValidationErrorType = 'delay_direction' | 'phase_missed' | 'spl_overlimit';

export interface ValidationError {
  id: string;
  type: ValidationErrorType;
  severity: 'warning' | 'error';
  description: string;
  affectedResultIds: string[];
  affectedCount: number;
}

export interface CalculationResult {
  id: string;
  pointId: string;
  x: number;
  y: number;
  totalSpl: number;
  totalIntensity: number;
  phaseCancelFactor: number;
  maxPhaseDiff: number;
  intermediates: IntermediateValue[];
  phaseIntermediates: PhaseIntermediate[];
  errors: ValidationError[];
}

export interface VersionMeta {
  version: string;
  source: string;
  timestamp: string;
  speakerCount: number;
  pointCount: number;
  frequency: number;
  splThreshold: number;
}

export interface AppState {
  speakers: Speaker[];
  measurePoints: MeasurePoint[];
  results: CalculationResult[];
  errors: ValidationError[];
  versionMeta: VersionMeta;
  selectedResultId: string | null;
  splThreshold: number;
  frequency: number;
  isCalculating: boolean;
}

export interface AppActions {
  addSpeaker: (speaker: Omit<Speaker, 'id'>) => void;
  updateSpeaker: (id: string, speaker: Partial<Speaker>) => void;
  removeSpeaker: (id: string) => void;
  setSpeakers: (speakers: Speaker[]) => void;
  setSplThreshold: (threshold: number) => void;
  setFrequency: (frequency: number) => void;
  setVersionMeta: (meta: Partial<VersionMeta>) => void;
  calculate: () => void;
  selectResult: (id: string | null) => void;
  exportJSON: () => void;
  exportCSV: () => void;
  loadDemoData: () => void;
  reset: () => void;
}

export type StoreType = AppState & AppActions;

export const ERROR_TYPE_LABELS: Record<ValidationErrorType, string> = {
  delay_direction: '延时方向错误',
  phase_missed: '相位抵消漏算',
  spl_overlimit: '声压超限',
};

export const ERROR_TYPE_COLORS: Record<ValidationErrorType, string> = {
  delay_direction: 'bg-amber-500',
  phase_missed: 'bg-orange-500',
  spl_overlimit: 'bg-red-500',
};
