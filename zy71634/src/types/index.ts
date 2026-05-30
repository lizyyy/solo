
export type WalletStatus = 'normal' | 'warning' | 'anomaly' | 'pending' | 'rejected';
export type TransactionStatus = 'confirmed' | 'pending' | 'failed';
export type AnomalyType = 'merge_error' | 'time_mismatch' | 'cycle_transfer' | 'suspicious';
export type WorkflowStatus = 'draft' | 'submitted' | 'returned' | 'approved';

export interface TokenBalance {
  symbol: string;
  amount: number;
  value: number;
}

export interface Wallet {
  id: string;
  address: string;
  label: string;
  balance: number;
  tokens: TokenBalance[];
  tags: string[];
  status: WalletStatus;
  notes: string;
  firstSeen: number;
  lastActive: number;
  metadata: Record<string, any>;
}

export interface Transaction {
  id: string;
  txHash: string;
  from: string;
  to: string;
  amount: number;
  token: string;
  timestamp: number;
  status: TransactionStatus;
  isAnomaly: boolean;
  anomalyType?: AnomalyType;
  notes?: string;
  workflowStatus?: WorkflowStatus;
}

export interface Node3D {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  wallet: Wallet;
  isSelected: boolean;
  isHighlighted: boolean;
}

export interface Edge3D {
  id: string;
  source: string;
  target: string;
  transaction: Transaction;
  isHighlighted: boolean;
  isAnomaly: boolean;
}

export interface ForceParams {
  linkDistance: number;
  linkStrength: number;
  charge: number;
  gravity: number;
  centerStrength: number;
}

export interface FilterOptions {
  showNormal: boolean;
  showWarning: boolean;
  showAnomaly: boolean;
  showPending: boolean;
  minAmount: number;
  selectedTokens: string[];
}

export interface AppState {
  wallets: Wallet[];
  transactions: Transaction[];
  selectedWalletId: string | null;
  highlightedPath: string[];
  timeRange: [number, number];
  filterOptions: FilterOptions;
  forceParams: ForceParams;
  isPlaying: boolean;
  playSpeed: number;
  currentTime: number;
}

export interface AppActions {
  setSelectedWallet: (id: string | null) => void;
  setHighlightedPath: (path: string[]) => void;
  setTimeRange: (range: [number, number]) => void;
  setFilterOptions: (options: Partial<FilterOptions>) => void;
  setForceParams: (params: Partial<ForceParams>) => void;
  togglePlaying: () => void;
  setPlaySpeed: (speed: number) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  updateWallet: (id: string, updates: Partial<Wallet>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  updateWalletTags: (id: string, tags: string[]) => void;
  updateWorkflowStatus: (txId: string, status: WorkflowStatus) => void;
}
