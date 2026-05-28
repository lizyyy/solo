
export interface ColorParams {
  exposure: number;
  temperature: number;
  lutId: string | null;
  lutIntensity: number;
}

export type ActionType = 'exposure' | 'temperature' | 'lut' | 'reset' | 'revert' | 'manual_correction' | 'note';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  actionType: ActionType;
  params: ColorParams;
  previousParams?: ColorParams;
  operator: string;
  note?: string;
  modificationSource?: string;
  isManualCorrection?: boolean;
}

export type IssueType = 'skin_shift' | 'shadows_clipped' | 'lut_overdose';
export type Severity = 'warning' | 'error';

export interface IssueDetected {
  type: IssueType;
  severity: Severity;
  message: string;
  value: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface ScoreResult {
  overall: number;
  brightness: number;
  color: number;
  detail: number;
  grade: Grade;
  issues: IssueDetected[];
}

export interface LUTPreset {
  id: string;
  name: string;
  description: string;
  data: number[][][];
}

export interface Level {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3;
  sourceImage: string;
  targetImage: string;
  targetParams: ColorParams;
  description: string;
}

export interface GradingReport {
  id: string;
  levelId: string;
  levelName: string;
  timestamp: number;
  operator: string;
  finalParams: ColorParams;
  targetParams: ColorParams;
  score: ScoreResult;
  history: HistoryEntry[];
  comparisonScreenshot: string;
  sourceImage: string;
  targetImage: string;
  notes: string;
  manualCorrections: HistoryEntry[];
}

export interface LevelProgress {
  bestScore: number;
  completed: boolean;
  attempts: number;
}
