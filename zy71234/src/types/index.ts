export type CardType = 'copyright' | 'artist' | 'platform' | 'clause' | 'action';
export type CardRarity = 'common' | 'rare' | 'epic';
export type PartyType = 'songwriter' | 'recording' | 'publisher';
export type IssueType = 'split_mismatch' | 'right_missing' | 'deduction_ignored';
export type IssueSeverity = 'critical' | 'major' | 'minor';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'settled';
export type PageType = 'home' | 'levels' | 'game' | 'settlement' | 'report';

export interface CardEffect {
  type: 'split_modifier' | 'right_add' | 'risk_add' | 'reputation_mod' | 'deduction_add';
  target: PartyType | 'all';
  value: number;
  right?: string;
  condition?: string;
  isRaw?: boolean;
}

export interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
  effect: CardEffect;
  rarity: CardRarity;
  rawData?: Record<string, any>;
}

export interface PartyState {
  id: string;
  name: string;
  type: PartyType;
  splitPercentage: number;
  rawSplitPercentage: number;
  rights: string[];
  rawRights: string[];
  risks: string[];
  reputation: number;
}

export interface SplitDetail {
  partyId: string;
  partyName: string;
  partyType: PartyType;
  baseSplit: number;
  rawSplit: number;
  modifiers: Array<{
    cardId: string;
    cardName: string;
    value: number;
  }>;
  finalSplit: number;
  amount: number;
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  source: string;
  sourceCardId?: string;
  rawData: string;
  processedResult: string;
  explanation: string;
}

export interface Settlement {
  id: string;
  gameId: string;
  totalRevenue: number;
  rawTotalRevenue: number;
  splits: SplitDetail[];
  issues: Issue[];
  reputationScore: number;
  rawReputationScore: number;
  deductions: Array<{
    name: string;
    amount: number;
    cardId: string;
  }>;
  finalPayout: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  unlocked: boolean;
  completed: boolean;
  stars: number;
  minStars: number;
  initialCards: string[];
  initialParties: PartyState[];
  totalRevenue: number;
  winCondition: {
    minReputation: number;
    maxCriticalIssues: number;
    maxMajorIssues: number;
  };
}

export interface Game {
  id: string;
  levelId: string;
  playerHand: Card[];
  tableCards: Card[];
  partyStates: PartyState[];
  currentRound: number;
  maxRounds: number;
  status: GameStatus;
  totalRevenue: number;
  playedCardIds: string[];
}

export interface GameState {
  currentPage: PageType;
  currentLevel: string | null;
  game: Game | null;
  settlement: Settlement | null;
  completedLevels: Record<string, number>;
  selectedCard: Card | null;
  showCardDetail: boolean;
}

export interface GameActions {
  setCurrentPage: (page: PageType) => void;
  setCurrentLevel: (levelId: string | null) => void;
  startGame: (levelId: string) => void;
  playCard: (cardId: string) => void;
  drawCard: () => void;
  endRound: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  calculateSettlement: () => void;
  setSelectedCard: (card: Card | null) => void;
  setShowCardDetail: (show: boolean) => void;
  exportReport: () => void;
  resetGame: () => void;
}

export interface NegotiationRecord {
  round: number;
  cardName: string;
  cardType: CardType;
  effect: string;
  timestamp: Date;
}

export interface ReportData {
  levelName: string;
  totalRevenue: number;
  finalPayout: number;
  splits: SplitDetail[];
  issues: Issue[];
  reputationScore: number;
  negotiationRecords: NegotiationRecord[];
  rawVsProcessed: Array<{
    item: string;
    raw: string;
    processed: string;
    difference: string;
  }>;
}
