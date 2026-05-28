export type RiskLevel = 'safe' | 'low' | 'medium' | 'high';

export type ChannelType = 'normal' | 'vip';

export type GamePhase = 'idle' | 'playing' | 'paused' | 'ended';

export type EventType = 'scan' | 'pass' | 'block' | 'warning' | 'check' | 'dispatch';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Item {
  id: string;
  name: string;
  icon: string;
  riskLevel: RiskLevel;
  isContraband: boolean;
  description: string;
}

export interface Audience {
  id: string;
  name: string;
  avatar: string;
  isVIP: boolean;
  isSpecial: boolean;
  specialType?: 'elderly' | 'child' | 'disabled';
  items: Item[];
  enterTime: number;
  queueStartTime: number;
  channel: ChannelType;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  type: EventType;
  audienceId?: string;
  audienceName?: string;
  itemId?: string;
  itemName?: string;
  channel: ChannelType;
  scoreChange: number;
  description: string;
  needReview: boolean;
  reviewed: boolean;
  reviewNote: string;
}

export interface ScoreBreakdown {
  accuracy: number;
  efficiency: number;
  vipService: number;
  emergency: number;
}

export interface GameSession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  difficulty: Difficulty;
  totalAudience: number;
  events: GameEvent[];
  scores: ScoreBreakdown;
  finalScore: number;
}

export interface GameStats {
  totalScanned: number;
  totalPassed: number;
  totalBlocked: number;
  contrabandFound: number;
  contrabandMissed: number;
  avgWaitTime: number;
  vipAvgWaitTime: number;
  warnings: number;
  specialHandled: number;
}
