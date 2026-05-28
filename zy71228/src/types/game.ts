export type GameStatus = 'active' | 'finished' | 'replaying';
export type RoundStatus = 'pending' | 'confirmed';
export type ActionStatus = 'tentative' | 'confirmed';
export type RiskStatus = 'normal' | 'warning' | 'danger';
export type NoteCategory = 'policy' | 'liquidity' | 'rate' | 'event' | 'report';
export type PolicyType = 'reverse_repo' | 'mlf';
export type PolicyDirection = 'inject' | 'withdraw';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Game {
  id: string;
  title: string;
  difficulty: Difficulty;
  currentRound: number;
  maxRounds: number;
  status: GameStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyAction {
  id: string;
  roundNumber: number;
  type: PolicyType;
  direction: PolicyDirection;
  amount: number;
  term: number;
  status: ActionStatus;
  notes?: string;
}

export interface MarketState {
  roundNumber: number;
  liquidity: number;
  dr007: number;
  t10y: number;
  excessReserveRatio: number;
  maturityGap: number;
  liquidityRisk: RiskStatus;
  rateLagEffect: number;
  pendingRateChange: number;
}

export interface EventOption {
  id: string;
  label: string;
  effectDescription: string;
  liquidityModifier: number;
  rateModifier: number;
}

export interface EventCard {
  id: string;
  roundNumber: number;
  title: string;
  description: string;
  impactType: 'liquidity' | 'rate' | 'expectation';
  impactValue: number;
  options: EventOption[];
  selectedOptionId?: string;
}

export interface LiquidityLog {
  id: string;
  roundNumber: number;
  beforeValue: number;
  afterValue: number;
  changeReason: string;
}

export interface ClassNote {
  id: string;
  gameId: string;
  content: string;
  status: ActionStatus;
  category: NoteCategory;
  createdAt: string;
}

export interface GameState {
  game: Game;
  marketHistory: MarketState[];
  policyActions: PolicyAction[];
  eventCards: EventCard[];
  liquidityLogs: LiquidityLog[];
  classNotes: ClassNote[];
  currentEvent: EventCard | null;
  roundStatus: RoundStatus;
  error: string | null;
}
