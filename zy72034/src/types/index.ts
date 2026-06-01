export type GameStatus = 'idle' | 'running' | 'paused' | 'ended';

export type TransactionType = 'buy' | 'sell';

export type TransactionStatus = 'pending' | 'confirmed' | 'rejected';

export interface Game {
  id: string;
  currentRound: number;
  status: GameStatus;
  totalRounds: number;
  createdAt: string;
  endedAt?: string;
  restartFromRound?: number;
  restartReason?: string;
}

export interface Farm {
  id: string;
  name: string;
  owner: string;
  initialQuota: number;
  color: string;
}

export interface Round {
  roundNumber: number;
  carbonPrice: number;
  startTime: string;
  endTime?: string;
  settlementReason: string;
  isSupplemented: boolean;
  priceFluctuation: number;
}

export interface Transaction {
  id: string;
  farmId: string;
  roundNumber: number;
  type: TransactionType;
  amount: number;
  price: number;
  status: TransactionStatus;
  needsReview: boolean;
  reviewReason?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface FarmState {
  farmId: string;
  roundNumber: number;
  carbonQuota: number;
  landArea: number;
  cropType: string;
  revenue: number;
  warning?: string;
}

export interface PauseRecord {
  id: string;
  roundNumber: number;
  pauseTime: string;
  resumeTime?: string;
  reason: string;
}

export interface SupplementRecord {
  id: string;
  roundNumber: number;
  farmId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  difference: string;
  remark: string;
  confirmedAt: string;
  confirmedBy: string;
}

export interface GameSnapshot {
  game: Game;
  currentRoundState: Round | null;
  farmStates: FarmState[];
  transactions: Transaction[];
  pauseRecords: PauseRecord[];
  supplementRecords: SupplementRecord[];
  timestamp: string;
}

export interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  delta?: number;
}

export interface DifferenceReport {
  hasChanges: boolean;
  diffs: FieldDiff[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
