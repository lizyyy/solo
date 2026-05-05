export interface SeedlingTray {
  trayId: string;
  bedId: string;
  seedlingType: string;
  quantity: number;
  plantingDate: string;
  currentStage: string;
  targetMoisture: number;
  targetEc: number;
  nozzles: string[];
}

export interface MoistureSensorData {
  sensorId: string;
  bedId: string;
  timestamp: string;
  moisture: number;
  ec: number;
  temperature: number;
}

export interface NozzleCalibration {
  nozzleId: string;
  bedId: string;
  flowRate: number;
  lastCalibrationDate: string;
  status: 'normal' | 'clogged' | 'leaking';
  deviationPercentage: number;
}

export interface NutrientRecipe {
  recipeId: string;
  seedlingType: string;
  stage: string;
  ecTarget: number;
  phTarget: number;
  nutrients: {
    name: string;
    concentration: number;
    unit: string;
  }[];
}

export enum RiskType {
  NO_RISK = 'no_risk',
  UNDER_WATERING = 'under_watering',
  OVER_WATERING = 'over_watering',
  HIGH_EC = 'high_ec',
  CLOGGED_NOZZLE = 'clogged_nozzle',
  MULTIPLE = 'multiple'
}

export interface Risk {
  type: RiskType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface BedAnalysis {
  bedId: string;
  trayCount: number;
  seedlingTypes: string[];
  avgMoisture: number;
  targetMoisture: number;
  avgEc: number;
  targetEc: number;
  nozzles: string[];
  nozzleStatus: Record<string, 'normal' | 'clogged' | 'leaking'>;
  risks: Risk[];
  suggestedWateringAmount: number;
  suggestedWateringDuration: number;
  manualOverride?: {
    isOverridden: boolean;
    overrideReason: string;
    overrideDecision: 'ignore' | 'mark_as_resolved' | 'assign_to_technician';
  };
  notes: string;
  lastUpdated: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: string[];
}

export interface ApplicationState {
  seedlingTrays: SeedlingTray[];
  sensorData: MoistureSensorData[];
  nozzleCalibrations: NozzleCalibration[];
  nutrientRecipes: NutrientRecipe[];
  bedAnalyses: BedAnalysis[];
  lastUpdated: string;
  isUsingSampleData: boolean;
}
