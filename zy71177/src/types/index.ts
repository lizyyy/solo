export interface WaterQuality {
  cod: number;
  nh3n: number;
  tp: number;
  ph: number;
  timestamp: number;
}

export interface LevelParameters {
  chemicalEfficiency: number;
  reboundFactor: number;
  minStirringTime: number;
  maxChemicalDose: number;
  incomingWaterVariation: number;
  optimalDosePerUnit: {
    cod: number;
    nh3n: number;
    tp: number;
  };
}

export interface Level {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  maxRounds: number;
  initialWaterQuality: Omit<WaterQuality, 'timestamp'>;
  targetThresholds: Omit<WaterQuality, 'timestamp'>;
  chemicalCost: number;
  stirringCostPerSecond: number;
  parameters: LevelParameters;
}

export interface TankState {
  volume: number;
  chemicalAmount: number;
  stirringTime: number;
  isStirring: boolean;
}

export interface GameAction {
  round: number;
  type: 'dose' | 'stir' | 'next';
  chemicalAmount?: number;
  stirringTime?: number;
  beforeQuality: WaterQuality;
  afterQuality: WaterQuality;
  cost: number;
  timestamp: number;
}

export interface GameState {
  currentLevel: Level | null;
  phase: 'menu' | 'playing' | 'paused' | 'ended';
  round: number;
  maxRounds: number;
  score: number;
  totalCost: number;
  tankState: TankState;
  waterQuality: WaterQuality;
  qualityHistory: WaterQuality[];
  actions: GameAction[];
  startTime: number;
  endTime: number | null;
  failReason: string | null;
  insufficientStirringCount: number;
  overdoseCount: number;
  successCount: number;
}

export interface GameRecord {
  id: string;
  levelId: string;
  levelName: string;
  score: number;
  totalCost: number;
  roundsCompleted: number;
  maxRounds: number;
  success: boolean;
  failReason: string | null;
  startTime: number;
  endTime: number;
  actions: GameAction[];
  qualityHistory: WaterQuality[];
  insufficientStirringCount: number;
  overdoseCount: number;
  successCount: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  costPenalty: number;
  stirringPenalty: number;
  overdosePenalty: number;
  finalScore: number;
  stars: number;
}
