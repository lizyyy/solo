export interface Plant {
  id: string;
  name: string;
  variety: string;
  growthStage: string;
  minMoisture: number;
  maxMoisture: number;
  optimalMoisture: number;
  waterNeedCoefficient: number;
  lightNeed: number;
}

export interface Pot {
  id: string;
  name: string;
  plantId: string;
  volume: number;
  drainHoles: number;
  drainageRate: number;
  surfaceArea: number;
  soilType: string;
  soilWaterRetention: number;
  soilFieldCapacity: number;
  soilPermanentWiltingPoint: number;
}

export interface Weather {
  date: string;
  temperature: number;
  humidity: number;
  solarRadiation: number;
  windSpeed: number;
  precipitation: number;
}

export interface WateringEvent {
  date: string;
  time: 'morning' | 'afternoon' | 'evening' | string;
  amount: number;
  fertilizerAmount: number;
  fertilizerType: string;
}

export interface WateringPlan {
  planId: string;
  planName: string;
  description: string;
  wateringEvents: WateringEvent[];
}

export interface SimulatedPotState {
  potId: string;
  potName: string;
  plantId: string;
  plantName: string;
  date: string;
  period: 'morning' | 'afternoon' | 'evening';
  soilMoisture: number;
  soilMoisturePercent: number;
  actualEvapotranspiration: number;
  potentialEvapotranspiration: number;
  drainage: number;
  wateringAmount: number;
  fertilizerAmount: number;
  precipitationAmount: number;
}

export type RiskType = 'drought' | 'waterlogging' | 'rootRot' | 'etiolation' | 'fertilizerBurn';

export interface RiskEvent {
  potId: string;
  potName: string;
  plantName: string;
  date: string;
  riskType: RiskType;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  contributingFactors: string[];
  suggestion: string;
}

export interface PlanComparisonResult {
  planId: string;
  planName: string;
  totalRiskScore: number;
  riskCount: { [key in RiskType]: number };
  stabilityIndex: number;
  waterEfficiency: number;
  summary: string;
}

export interface SimulationResult {
  planId: string;
  planName: string;
  potStates: SimulatedPotState[];
  risks: RiskEvent[];
  summary: {
    totalDays: number;
    totalPots: number;
    riskBreakdown: { [key in RiskType]: number };
    averageMoisturePerPot: { [potId: string]: number };
  };
}

export interface ValidationError {
  field: string;
  row?: number;
  value: unknown;
  expectedType: string;
  errorType: 'missing' | 'invalid_type' | 'out_of_range' | 'date_gap' | 'duplicate' | 'invalid_reference';
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
