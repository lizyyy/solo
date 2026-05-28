export type OptionType = 'call' | 'put' | 'underlying';

export interface GreekValues {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

export interface Position {
  id: string;
  contractCode: string;
  type: OptionType;
  strike: number;
  expiryDays: number;
  quantity: number;
  costPrice: number;
  currentPrice?: number;
  marketValue?: number;
  pnl?: number;
  individualGreeks?: GreekValues;
}

export interface MarketEvent {
  round: number;
  underlyingPrice: number;
  priceChange: number;
  volatility: number;
  volatilityChange: number;
  daysPassed: number;
  isShock: boolean;
  description: string;
  handwrittenNote?: string;
}

export interface MarginConfig {
  initialMarginRate: number;
  maintenanceMarginRate: number;
  marginCallThreshold: number;
}

export interface FeeConfig {
  optionTradingFee: number;
  underlyingTradingFee: number;
  exerciseFee: number;
  slippage: number;
}

export interface GreekTarget {
  delta: { min: number; max: number };
  gamma: { min: number; max: number };
  vega: { min: number; max: number };
}

export interface GameMaterials {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  initialUnderlyingPrice: number;
  initialPositions: Position[];
  marketEvents: MarketEvent[];
  marginConfig: MarginConfig;
  feeConfig: FeeConfig;
  greekTargets: GreekTarget;
  initialCash: number;
}

export interface MarginStatus {
  initialMargin: number;
  maintenanceMargin: number;
  availableMargin: number;
  marginRatio: number;
  marginCall: boolean;
}

export interface PositionChange {
  positionId: string;
  contractCode: string;
  changeQuantity: number;
  executionPrice: number;
  fee: number;
  pnlRealized: number;
}

export interface ActionRecord {
  round: number;
  timestamp: number;
  type: 'adjust' | 'stopLoss' | 'hold';
  positionChanges: PositionChange[];
  totalCost: number;
  greeksBefore: GreekValues;
  greeksAfter: GreekValues;
  errorType?: string;
  errorNote?: string;
}

export interface MarketSnapshot {
  round: number;
  underlyingPrice: number;
  volatility: number;
  greeks: GreekValues;
  margin: MarginStatus;
  totalPnL: number;
  action?: ActionRecord;
}

export type GameStatus = 'idle' | 'playing' | 'ended' | 'bankrupt';

export interface GameState {
  id: string;
  materialId: string;
  materialName: string;
  currentRound: number;
  totalRounds: number;
  status: GameStatus;
  positions: Position[];
  currentGreeks: GreekValues;
  marginStatus: MarginStatus;
  cash: number;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  actionHistory: ActionRecord[];
  marketHistory: MarketSnapshot[];
  currentMarket: MarketEvent | null;
  bankruptRound?: number;
  bankruptReason?: string;
}

export interface ErrorAnalysis {
  round: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  consequence: string;
  correctAction: string;
}

export interface ReviewScores {
  riskManagement: number;
  costControl: number;
  decisionTiming: number;
  greekStability: number;
  overall: number;
}

export interface ReviewReport {
  gameId: string;
  materialName: string;
  scores: ReviewScores;
  errors: ErrorAnalysis[];
  timeline: MarketSnapshot[];
  finalPnL: number;
  totalRounds: number;
  playedRounds: number;
}

export interface VersionComparison {
  oldMaterials: GameMaterials;
  newMaterials: GameMaterials;
  oldResult?: ReviewReport;
  newResult?: ReviewReport;
  parameterDiffs: ParameterDiff[];
}

export interface ParameterDiff {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  category: 'position' | 'market' | 'margin' | 'fee' | 'target';
}
