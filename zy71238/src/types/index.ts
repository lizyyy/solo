export interface IndexComponent {
  code: string;
  name: string;
  weight: number;
  price: number;
  isSuspended: boolean;
  suspendedReason?: string;
}

export interface Holding {
  code: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  isSuspended: boolean;
}

export interface GameEvent {
  id: string;
  type: 'subscription' | 'redemption' | 'suspension' | 'marketMove';
  title: string;
  description: string;
  amount?: number;
  affectedStock?: string;
  priceChange?: number;
  timeLimit: number;
}

export interface OperationLog {
  round: number;
  timestamp: number;
  type: 'buy' | 'sell' | 'eventHandle';
  stockCode?: string;
  stockName?: string;
  quantity?: number;
  price?: number;
  description: string;
  trackingErrorImpact: number;
}

export interface Warning {
  id: string;
  type: 'cash_excess' | 'suspension_mismatch' | 'error_accumulation';
  severity: 'warning' | 'critical';
  message: string;
  suggestion: string;
  timestamp: number;
}

export interface GameState {
  round: number;
  maxRounds: number;
  cash: number;
  totalAssets: number;
  holdings: Holding[];
  indexComponents: IndexComponent[];
  trackingError: number;
  trackingErrorHistory: number[];
  netValueHistory: number[];
  indexValueHistory: number[];
  currentEvent: GameEvent | null;
  operationLogs: OperationLog[];
  warnings: Warning[];
  gameStatus: 'idle' | 'playing' | 'paused' | 'ended';
  initialNav: number;
  indexBaseValue: number;
}

export interface GameActions {
  initializeGame: (components: IndexComponent[]) => void;
  buyStock: (code: string, quantity: number) => void;
  sellStock: (code: string, quantity: number) => void;
  handleEvent: () => void;
  nextRound: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  endGame: () => void;
}
