export interface Bond {
  id: string;
  name: string;
  faceValue: number;
  couponRate: number;
  currentPrice: number;
  maturityRound: number;
  issueRound: number;
  source: string;
  version: string;
}

export interface Position {
  bondId: string;
  quantity: number;
  avgCost: number;
}

export interface InterestEvent {
  id: string;
  round: number;
  rateChange: number;
  description: string;
  direction: 'up' | 'down' | 'stable';
  source: string;
}

export interface Transaction {
  id: string;
  round: number;
  type: 'buy' | 'sell';
  bondId: string;
  quantity: number;
  price: number;
  timestamp: number;
}

export interface CouponRecord {
  id: string;
  round: number;
  bondId: string;
  quantity: number;
  expectedAmount: number;
  actualAmount: number;
  source: string;
}

export type GameErrorType = 'coupon_missed' | 'rate_reversed' | 'cash_overdraft';

export interface GameError {
  id: string;
  round: number;
  type: GameErrorType;
  description: string;
  impact: {
    metric: string;
    expectedValue: number;
    actualValue: number;
    difference: number;
  };
  affectedResults: string[];
}

export interface RoundSnapshot {
  round: number;
  marketRate: number;
  cash: number;
  totalAssets: number;
  bondPrices: { [bondId: string]: number };
  positions: Position[];
  event: InterestEvent | null;
  errors: GameError[];
  couponIncome: number;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface GameState {
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  marketRate: number;
  initialRate: number;
  cash: number;
  initialCash: number;
  positions: Position[];
  bonds: Bond[];
  events: InterestEvent[];
  transactions: Transaction[];
  couponRecords: CouponRecord[];
  errors: GameError[];
  history: RoundSnapshot[];
  version: string;
  source: string;
  selectedBondId: string | null;
  reviewMode: boolean;
  reviewRound: number;
}

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
  | { type: 'RESET_GAME' }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_GAME' }
  | { type: 'SELECT_BOND'; payload: string | null }
  | { type: 'BUY_BOND'; payload: { bondId: string; quantity: number } }
  | { type: 'SELL_BOND'; payload: { bondId: string; quantity: number } }
  | { type: 'SET_REVIEW_MODE'; payload: { enabled: boolean; round?: number } };
