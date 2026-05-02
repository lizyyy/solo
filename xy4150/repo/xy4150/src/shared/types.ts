export type HandActionType = 'fist' | 'palm' | 'pinch';

export type TrainingPhase = 
  | 'idle'
  | 'countdown'
  | 'active'
  | 'paused'
  | 'completed';

export interface HandAction {
  id: string;
  type: HandActionType;
  label: string;
  description: string;
}

export interface TrainingStep {
  id: string;
  actionId: string;
  beatCount: number;
  holdBeats?: number;
}

export interface TrainingPlan {
  id: string;
  name: string;
  description: string;
  bpm: number;
  beatsPerMeasure: number;
  steps: TrainingStep[];
  repeatCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PainRecord {
  timestamp: number;
  stepIndex: number;
  intensity: number;
  note?: string;
}

export interface PauseRecord {
  startTime: number;
  endTime: number;
  reason?: string;
  stepIndex: number;
}

export interface ActionResult {
  stepIndex: number;
  expectedAction: HandActionType;
  actualAction: HandActionType | null;
  timestamp: number;
  isCorrect: boolean;
  timingOffsetMs: number;
  isMissed: boolean;
}

export interface TrainingSession {
  id: string;
  planId: string;
  planName: string;
  startTime: number;
  endTime: number | null;
  phase: TrainingPhase;
  currentStepIndex: number;
  currentBeat: number;
  actionResults: ActionResult[];
  painRecords: PainRecord[];
  pauseRecords: PauseRecord[];
  totalCorrect: number;
  totalIncorrect: number;
  totalMissed: number;
  avgTimingOffset: number;
}

export interface InputEvent {
  type: HandActionType;
  timestamp: number;
  source: 'keyboard' | 'camera';
}

export interface MetronomeBeat {
  beatNumber: number;
  isStrongBeat: boolean;
  timestamp: number;
}

export interface ScoreResult {
  accuracyPercentage: number;
  timingScore: number;
  rhythmScore: number;
  overallScore: number;
  totalActions: number;
  correctActions: number;
  missedActions: number;
}

export interface ChartDataPoint {
  step: number;
  action: string;
  accuracy: number;
  timing: number;
  pain: number | null;
}

export interface ReportData {
  session: TrainingSession;
  plan: TrainingPlan;
  score: ScoreResult;
  chartData: ChartDataPoint[];
}
