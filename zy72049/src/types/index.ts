export type RecordStatus = 'success' | 'pending' | 'legacy';
export type RecordSource = 'system' | 'student_import';
export type ActionType = 'drag' | 'click' | 'pause' | 'resume';
export type RiskLevel = 0 | 1 | 2 | 3;

export interface Obstacle {
  id: string;
  type: 'static' | 'moving' | 'unknown';
  x: number;
  y: number;
  riskWeight: number;
  energyCost: number;
  computeCost: number;
  timeCost: number;
  scoreBonus: number;
  handled?: boolean;
}

export interface ConflictData {
  studentClaim: {
    description: string;
    reportedScore: number;
    reportedResources: { energy: number; compute: number; time: number };
  };
  systemData: {
    description: string;
    calculatedScore: number;
    calculatedResources: { energy: number; compute: number; time: number };
  };
  evidences: {
    source: 'student' | 'system';
    content: string;
    timestamp: string;
  }[];
  suggestions: string[];
  resolved: boolean;
}

export interface TrainingRecord {
  id: string;
  title: string;
  status: RecordStatus;
  source: RecordSource;
  initialResources: {
    energy: number;
    compute: number;
    time: number;
  };
  baseScore: number;
  obstacles: Obstacle[];
  conflictData?: ConflictData;
  createdAt: string;
  description: string;
}

export interface DecisionStep {
  id: string;
  timestamp: number;
  actionType: ActionType;
  obstacleId?: string;
  resourceDelta: { energy: number; compute: number; time: number };
  scoreDelta: number;
  riskLevel: RiskLevel;
  description: string;
}

export interface ResourceState {
  energy: number;
  compute: number;
  time: number;
  score: number;
  riskLevel: RiskLevel;
  isNegative: boolean;
  negativeWarning?: string;
}

export interface TrainingState {
  currentRecordId: string | null;
  resources: ResourceState;
  decisionHistory: DecisionStep[];
  obstacles: Obstacle[];
  isPaused: boolean;
  isCompleted: boolean;
  conflictResolved: boolean;
}
