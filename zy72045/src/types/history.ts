import type { GameState, NewsConfig, TradeRecord, Settlement, Position } from './game';

export interface HistoryRecord {
  id: string;
  gameId: string;
  configId: string;
  configName: string;
  startTime: string;
  endTime: string;
  totalRounds: number;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  settlement: Settlement;
  finalPositions: Position[];
  newsHistory: NewsConfig[];
  trades: TradeRecord[];
  rounds: HistoryRound[];
}

export interface HistoryRound {
  roundNumber: number;
  marketIndex: number;
  news: NewsConfig[];
  trades: TradeRecord[];
  positions: Position[];
  capital: number;
  timestamp: string;
}

export interface ReplayState {
  currentRound: number;
  isPlaying: boolean;
  speed: number;
}
