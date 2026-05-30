export type JudgeType = 'perfect' | 'good' | 'miss' | 'early' | 'late';
export type GameStatus = 'idle' | 'playing' | 'paused' | 'ended';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type AnomalyType = 'beat_offset' | 'train_collision' | 'passenger_overflow';
export type Severity = 'warning' | 'danger';

export interface Train {
  id: string;
  departureTime: number;
  position: number;
  speed: number;
  status: 'waiting' | 'running' | 'arrived';
  platformId: string;
}

export interface Platform {
  id: string;
  name: string;
  passengerCount: number;
  maxCapacity: number;
  congestionLevel: number;
  overflowCount: number;
  history: { time: number; count: number }[];
}

export interface BeatPoint {
  id: string;
  time: number;
  isHit: boolean;
  judgeType?: JudgeType;
  offset?: number;
}

export interface DispatchRecord {
  id: string;
  time: number;
  trainId: string;
  platformId: string;
  judgeType: JudgeType;
  offset: number;
}

export interface AnomalyEvent {
  id: string;
  type: AnomalyType;
  time: number;
  severity: Severity;
  description: string;
  data: Record<string, unknown>;
}

export interface GameStatistics {
  perfect: number;
  good: number;
  miss: number;
  early: number;
  late: number;
}

export interface GameState {
  status: GameStatus;
  difficulty: Difficulty;
  score: number;
  energy: number;
  combo: number;
  maxCombo: number;
  currentTime: number;
  totalTime: number;
  beatPoints: BeatPoint[];
  trains: Train[];
  platforms: Platform[];
  dispatchRecords: DispatchRecord[];
  anomalies: AnomalyEvent[];
  statistics: GameStatistics;
  lastDispatchTime: number;
}

export interface TeachingReport {
  basicInfo: {
    date: string;
    duration: number;
    difficulty: string;
    finalScore: number;
    grade: string;
  };
  rhythmAnalysis: {
    totalBeats: number;
    hitRate: number;
    judgeDistribution: { perfect: number; good: number; miss: number };
    offsetDistribution: { early: number; late: number };
    averageOffset: number;
  };
  dispatchAnalysis: {
    totalDispatches: number;
    avgInterval: number;
    minInterval: number;
    collisionCount: number;
    queueEfficiency: number;
  };
  congestionAnalysis: {
    platformStats: {
      platformId: string;
      platformName: string;
      avgCongestion: number;
      maxCongestion: number;
      overflowCount: number;
    }[];
    totalOverflow: number;
  };
  anomalyDetails: AnomalyEvent[];
}

export const DIFFICULTY_CONFIG = {
  easy: {
    bpm: 80,
    passengerRate: 0.3,
    gameDuration: 60,
    perfectWindow: 60,
    goodWindow: 120,
  },
  normal: {
    bpm: 100,
    passengerRate: 0.5,
    gameDuration: 90,
    perfectWindow: 50,
    goodWindow: 100,
  },
  hard: {
    bpm: 120,
    passengerRate: 0.7,
    gameDuration: 120,
    perfectWindow: 40,
    goodWindow: 80,
  },
} as const;

export const PLATFORM_CONFIG = [
  { id: 'p1', name: '1号线-站台A', maxCapacity: 100 },
  { id: 'p2', name: '1号线-站台B', maxCapacity: 100 },
  { id: 'p3', name: '2号线-站台A', maxCapacity: 100 },
  { id: 'p4', name: '2号线-站台B', maxCapacity: 100 },
  { id: 'p5', name: '换乘站', maxCapacity: 150 },
  { id: 'p6', name: '终点站', maxCapacity: 80 },
];

export const INITIAL_STATISTICS: GameStatistics = {
  perfect: 0,
  good: 0,
  miss: 0,
  early: 0,
  late: 0,
};
