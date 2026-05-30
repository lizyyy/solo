export interface Artwork {
  id: string;
  name: string;
  artist: string;
  year: string;
  description: string;
  imageUrl: string;
  category: string;
}

export interface Valuation {
  lowEstimate: number;
  highEstimate: number;
  source: string;
  confidence: number;
  reservePrice: number;
}

export interface CollectorProfile {
  id: string;
  name: string;
  avatar: string;
  preferenceType: 'aggressive' | 'conservative' | 'selective' | 'opportunistic';
  aggressiveness: number;
  maxBudget: number;
  favoriteCategory: string;
  description: string;
}

export interface BidRecord {
  bidder: string;
  amount: number;
  timestamp: number;
  isImpulsive: boolean;
}

export interface ConflictLog {
  conflictType: 'estimate_vs_description' | 'collector_vs_estimate' | 'collector_vs_description';
  description: string;
  resolution: 'deferred' | 'player_judgment';
  roundIndex: number;
}

export interface AnomalyEvent {
  anomalyType: 'impulsive_bid' | 'reserve_misjudgment' | 'budget_overrun';
  description: string;
  severity: number;
  context: string;
  roundIndex: number;
}

export interface AuctionRound {
  artwork: Artwork;
  valuation: Valuation;
  activeCollectors: CollectorProfile[];
  bidRecords: BidRecord[];
  conflictLogs: ConflictLog[];
  anomalyEvents: AnomalyEvent[];
  finalPrice: number;
  winner: string | null;
  reservePrice: number;
  status: 'pending' | 'info_review' | 'bidding' | 'ended';
}

export type GameStatus = 'idle' | 'info_review' | 'bidding' | 'paused' | 'round_end' | 'settled';

export interface GameReport {
  sessionId: string;
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  rounds: {
    artworkName: string;
    artist: string;
    finalPrice: number;
    winner: string | null;
    reservePrice: number;
    bidCount: number;
    conflicts: ConflictLog[];
    anomalies: AnomalyEvent[];
  }[];
  allConflicts: ConflictLog[];
  allAnomalies: AnomalyEvent[];
  summary: {
    itemsWon: number;
    totalBids: number;
    impulsiveBids: number;
    reserveMisjudgments: number;
    budgetOverruns: number;
  };
}
