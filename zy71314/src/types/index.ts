export type FlagType = 'error' | 'warning' | 'info' | 'conflict';

export interface DataFlag {
  type: FlagType;
  message: string;
  field?: string;
  suggestion?: string;
}

export interface PendulumData {
  id: string;
  length: number;
  period: number;
  measurements: number;
  angle: number;
  studentName: string;
  notes: string;
  timestamp: number;
  flags: DataFlag[];
  excluded: boolean;
}

export interface ErrorSource {
  name: string;
  contribution: number;
  description: string;
  improvement: string;
}

export interface CalculationResult {
  gravity: number;
  gravityUncertainty: number;
  fitSlope: number;
  fitIntercept: number;
  rSquared: number;
  residuals: number[];
  outliers: string[];
  errorSources: ErrorSource[];
  validDataCount: number;
  totalDataCount: number;
}

export interface DemoSample {
  id: string;
  name: string;
  description: string;
  category: 'large-angle' | 'missing-period' | 'outlier';
  data: Partial<PendulumData>[];
  explanation: string;
}

export type ChartType = 't2-vs-l' | 'residual' | 'error-pie' | 'distribution';

export interface AppState {
  data: PendulumData[];
  result: CalculationResult | null;
  selectedChart: ChartType;
  studentName: string;
  experimentDate: string;
  isCalculating: boolean;
  error: string | null;
}
