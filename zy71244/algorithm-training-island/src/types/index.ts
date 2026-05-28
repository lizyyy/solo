export type KnowledgePoint = 
  | 'dp' 
  | 'graph' 
  | 'string' 
  | 'math' 
  | 'geometry' 
  | 'dataStructure' 
  | 'greedy' 
  | 'search';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ActivityType = 'practice' | 'review' | 'rest';

export type GamePhase = 'planning' | 'executing' | 'contest' | 'result';

export type GameStatus = 'playing' | 'won' | 'lost' | 'crashed';

export interface Member {
  id: string;
  name: string;
  avatar: string;
  overallAbility: number;
  fatigue: number;
  maxFatigue: number;
  knowledgePoints: Record<KnowledgePoint, number>;
  traits: string[];
  consecutivePracticeDays: number;
  consecutiveRestDays: number;
  lastActivity: ActivityType | null;
  reviewCount: number;
  practiceCount: number;
  crashCount: number;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  knowledgePoints: KnowledgePoint[];
  points: number;
  version: number;
  availableFromDay: number;
}

export interface TrainingActivity {
  id: string;
  type: ActivityType;
  memberId: string;
  day: number;
  problemId?: string;
  knowledgePoint?: KnowledgePoint;
  duration: number;
  timestamp: number;
}

export interface ActivityResult {
  activityId: string;
  memberId: string;
  type: ActivityType;
  day: number;
  success: boolean;
  fatigueChange: number;
  abilityChange: Record<KnowledgePoint, number>;
  overallAbilityChange: number;
  problemId?: string;
  knowledgePoint?: KnowledgePoint;
  message: string;
  isCrash: boolean;
}

export interface Contest {
  id: string;
  name: string;
  day: number;
  problems: Problem[];
  duration: number;
  targetScore: number;
  version: number;
}

export interface ContestResult {
  contestId: string;
  day: number;
  totalScore: number;
  targetScore: number;
  problemResults: Array<{
    problemId: string;
    solved: boolean;
    score: number;
    attemptedBy: string;
  }>;
  memberPerformances: Array<{
    memberId: string;
    score: number;
    fatigueUsed: number;
    problemsSolved: number;
  }>;
  passed: boolean;
  rank: number;
}

export interface KeyDecision {
  day: number;
  type: 'activity' | 'strategy' | 'adjustment';
  description: string;
  impact: string;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface ProblemDiscovery {
  id: string;
  day: number;
  type: 'fatigue' | 'knowledge_gap' | 'lack_of_review' | 'imbalance';
  description: string;
  severity: 'low' | 'medium' | 'high';
  discoveredBy: string;
}

export interface CorrectionAction {
  id: string;
  problemId: string;
  day: number;
  action: string;
  description: string;
  expectedEffect: string;
  confirmedBy: string;
  confirmedAt: number;
}

export interface TrainingReport {
  gameId: string;
  version: string;
  generatedAt: number;
  duration: number;
  finalStatus: GameStatus;
  finalScore: number;
  problemDiscoveries: ProblemDiscovery[];
  correctionActions: CorrectionAction[];
  keyDecisions: KeyDecision[];
  memberStats: Array<{
    memberId: string;
    name: string;
    finalAbility: number;
    finalFatigue: number;
    practiceCount: number;
    reviewCount: number;
    crashCount: number;
  }>;
  acknowledgers: string[];
}

export interface VersionInfo {
  dataVersion: string;
  schemaVersion: number;
  memberVersion: number;
  problemVersion: number;
  contestVersion: number;
  lastUpdated: number;
}

export interface ReplayStep {
  day: number;
  phase: GamePhase;
  state: Partial<GameState>;
  decisions: KeyDecision[];
  results: ActivityResult[];
  timestamp: number;
}

export interface Replay {
  id: string;
  gameId: string;
  startTime: number;
  endTime: number;
  steps: ReplayStep[];
  finalResult: GameStatus;
  finalScore: number;
  version: VersionInfo;
}

export interface GameState {
  id: string;
  currentDay: number;
  totalDays: number;
  phase: GamePhase;
  status: GameStatus;
  members: Member[];
  problems: Problem[];
  contests: Contest[];
  completedContests: ContestResult[];
  scheduledActivities: TrainingActivity[];
  activityResults: ActivityResult[];
  keyDecisions: KeyDecision[];
  problemDiscoveries: ProblemDiscovery[];
  correctionActions: CorrectionAction[];
  totalScore: number;
  targetScore: number;
  version: VersionInfo;
  replay: Replay;
  createdAt: number;
  updatedAt: number;
  settings: {
    fatigueRecoveryRate: number;
    practiceFatigueCost: number;
    reviewFatigueCost: number;
    knowledgeDecayRate: number;
    crashThreshold: number;
  };
}

export interface GameConfig {
  totalDays: number;
  contestInterval: number;
  initialMembers: Member[];
  initialProblems: Problem[];
  contests: Contest[];
  targetScore: number;
  settings: {
    fatigueRecoveryRate: number;
    practiceFatigueCost: number;
    reviewFatigueCost: number;
    knowledgeDecayRate: number;
    crashThreshold: number;
  };
}
