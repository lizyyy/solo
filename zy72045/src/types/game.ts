export type GameStatus = 'pending' | 'playing' | 'paused' | 'settled';

export type SourceType = 'reuters' | 'bloomberg' | 'projection_old' | 'manual' | 'other';

export type NewsConfidence = 'auto' | 'need_confirm' | 'manual';

export type TradeAction = 'buy' | 'sell' | 'hold';

export type SettleTrigger = 'round_end' | 'manual' | 'stop_loss' | 'take_profit';

export interface SourceInfo {
  originalSource: string;
  processTime: string;
  processor: string;
  suggestion: string;
  sourceType: SourceType;
}

export interface StockConfig {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
}

export interface NewsConfig extends SourceInfo {
  id: string;
  title: string;
  content: string;
  sourceName: string;
  publishTime: string;
  impactScore: number;
  confidence: NewsConfidence;
}

export interface RoundConfig {
  roundNumber: number;
  marketIndex: number;
  news: NewsConfig[];
}

export interface GameConfig {
  id: string;
  name: string;
  totalRounds: number;
  initialCapital: number;
  stocks: StockConfig[];
  rounds: RoundConfig[];
}

export interface ValidationError {
  type: 'empty_level' | 'duplicate_event' | 'boundary_violation';
  path: string;
  message: string;
  value?: any;
  boundary?: { min: number; max: number };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface TradeRecord {
  id: string;
  gameId: string;
  newsEventId: string;
  roundNumber: number;
  symbol: string;
  action: TradeAction;
  quantity: number;
  price: number;
  position: number;
  reason: string;
  timestamp: string;
}

export interface Settlement {
  id: string;
  gameId: string;
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  triggerCondition: SettleTrigger;
  settleTime: string;
}

export interface GameState {
  gameId: string | null;
  configId: string;
  configName: string;
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  initialCapital: number;
  currentCapital: number;
  settlementReason: string;
  isLocked: boolean;
  startTime: string | null;
  endTime: string | null;
  marketIndex: number;
  positions: Position[];
  trades: TradeRecord[];
  newsHistory: NewsConfig[];
  settlement: Settlement | null;
  validationErrors: ValidationError[];
  confirmedErrors: string[];
}
