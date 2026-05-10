export const FermentationStage = {
  PRE_FERMENT: 'pre_ferment',
  BULK_FERMENT: 'bulk_ferment',
  BENCH_REST: 'bench_rest',
  FINAL_PROOF: 'final_proof',
  COMPLETED: 'completed'
} as const;

export type FermentationStage = typeof FermentationStage[keyof typeof FermentationStage];

export const DoughType = {
  WHITE: 'white',
  WHOLE_WHEAT: 'whole_wheat',
  RYE: 'rye',
  SOURDOUGH: 'sourdough',
  MULTIGRAIN: 'multigrain'
} as const;

export type DoughType = typeof DoughType[keyof typeof DoughType];

export interface TemperatureRecord {
  id: string;
  batchId: string;
  stage: FermentationStage;
  temperature: number;
  recordedAt: string;
  note?: string;
}

export interface StageTransition {
  fromStage: FermentationStage | null;
  toStage: FermentationStage;
  timestamp: string;
  note?: string;
}

export interface Batch {
  id: string;
  batchNumber: string;
  doughType: DoughType;
  weight: number;
  targetTemperature: number;
  createdAt: string;
  currentStage: FermentationStage;
  stageTransitions: StageTransition[];
  temperatureRecords: TemperatureRecord[];
  notes?: string;
}

export interface Statistics {
  totalBatches: number;
  completedBatches: number;
  inProgressBatches: number;
  averageTemperature: number;
  stageDistribution: Record<FermentationStage, number>;
}
