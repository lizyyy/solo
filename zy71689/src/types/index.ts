export type RatingLevel = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';

export type GameMode = 'tutorial' | 'standard' | 'sample';

export type AnomalyType = 'DATA_ISSUE' | 'RULE_ISSUE' | 'MATERIAL_ISSUE';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'finished';

export type RoundStatus = 'waiting' | 'active' | 'submitted' | 'timeout';

export type NewsDirection = 'upgrade' | 'downgrade' | 'neutral';

export type NewsType = 'macro' | 'industry' | 'company' | 'policy' | 'market';

export interface RatingLevelConfig {
  level: RatingLevel;
  score: number;
  riskWeight: number;
  color: string;
}

export interface AnomalyTypeConfig {
  code: AnomalyType;
  label: string;
  color: string;
  icon: string;
  examples: string[];
}

export interface NewsEvent {
  id: string;
  title: string;
  content: string;
  type: NewsType;
  severity: 'low' | 'medium' | 'high';
  direction: NewsDirection;
  affectedBondCodes: string[];
  expectedRating: RatingLevel;
}

export interface Game {
  id: string;
  mode: GameMode;
  status: GameStatus;
  studentName?: string;
  initialNav: number;
  currentNav: number;
  cash: number;
  trustScore: number;
  totalScore: number;
  totalRounds: number;
  currentRoundIndex: number;
  holdings: BondHolding[];
  rounds: Round[];
  selectedBond: string | null;
  createdAt: string;
  finishedAt?: string;
}

export interface Round {
  id: string;
  roundNumber: number;
  news?: NewsEvent;
  affectedBondCodes: string[];
  action?: RatingAction;
  anomalies: Anomaly[];
  correctRating?: RatingLevel;
  roundScore: number;
  feedback?: string;
  navBefore: number;
  navAfter: number;
  holdingsBefore: BondHolding[];
  holdingsAfter: BondHolding[];
  isTimeout: boolean;
}

export interface Bond {
  id: string;
  code: string;
  name: string;
  issuer: string;
  faceValue: number;
  couponRate: number;
  maturityDate: string;
}

export interface BondHolding {
  id: string;
  bondId: string;
  bondCode: string;
  bondName: string;
  currentRating: RatingLevel;
  previousRating?: RatingLevel;
  faceValue: number;
  marketValue: number;
  position: number;
  riskWeight: number;
  adjustedValue: number;
}

export interface RatingAction {
  id: string;
  bondCode: string;
  bondName: string;
  oldRating: RatingLevel;
  newRating: RatingLevel;
  reason: string;
  timeSpent: number;
  reactionTime: number;
  navImpact: number;
  scoreImpact: number;
  isCorrect: boolean;
  hasAnomaly: boolean;
  timestamp: string;
  submittedAt: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  rootCause: string;
  suggestion: string;
  timestamp: string;
}

export interface GameReport {
  id: string;
  gameId: string;
  finalScore: number;
  finalNav: number;
  navChangePercent: number;
  accuracyRate: number;
  avgReactionTime: number;
  totalActions: number;
  correctActions: number;
  suggestions: string[];
  ratingDistribution: Record<RatingLevel, number>;
  generatedAt: string;
  anomalies: Record<AnomalyType, number>;
  actionTimeline: RatingAction[];
  anomalyDetails: Anomaly[];
}

export interface AccuracyResult {
  isCorrect: boolean;
  accuracy: 'correct' | 'near_miss' | 'wrong_direction';
  directionMatch: boolean;
  levelMatch: boolean;
}

export interface SampleFlowStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  keyPoints?: string[];
  highlightedRound?: number;
  showGameContent?: boolean;
  showExportDemo?: boolean;
  showSummary?: boolean;
}

export interface SampleFlowData {
  game: Game;
  steps: SampleFlowStep[];
  autoPlayInterval: number;
}
