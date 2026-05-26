export type InspectionPointType = 'door' | 'cabinet' | 'temperature' | 'ventilation' | 'form';

export type AnomalyType = 'temperature' | 'door' | 'equipment';

export type AnomalySeverity = 'warning' | 'critical';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ScoreDetailType = 
  | 'correct' 
  | 'wrong_order' 
  | 'skipped' 
  | 'duplicate' 
  | 'anomaly_unhandled' 
  | 'anomaly_not_upgraded' 
  | 'timeout' 
  | 'report_complete'
  | 'full_completion';

export type OperationType = 'inspect' | 'anomaly_handle' | 'anomaly_upgrade' | 'generate_report';

export type StepStatus = 'pending' | 'current' | 'completed' | 'skipped' | 'wrong';

export interface InspectionPoint {
  id: string;
  name: string;
  type: InspectionPointType;
  position: { x: number; y: number };
  icon: string;
  description: string;
}

export interface AnomalyConfig {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  triggerProbability: number;
  requiresUpgrade: boolean;
  description: string;
  relatedPointId: string;
}

export interface LevelConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  timeLimit: number;
  targetScore: number;
  inspectionPoints: InspectionPoint[];
  requiredOrder: string[];
  possibleAnomalies: AnomalyConfig[];
}

export interface ActiveAnomaly {
  configId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  isHandled: boolean;
  isUpgraded: boolean;
  triggeredAt: number;
  description: string;
  relatedPointId: string;
}

export interface ScoreDetail {
  id: string;
  type: ScoreDetailType;
  description: string;
  points: number;
  timestamp: number;
}

export interface OperationRecord {
  type: OperationType;
  targetId: string;
  timestamp: number;
  isCorrect: boolean;
  details: string;
}

export interface GameState {
  levelId: string;
  currentStep: number;
  completedSteps: string[];
  skippedSteps: string[];
  duplicateSteps: string[];
  wrongSteps: string[];
  activeAnomalies: ActiveAnomaly[];
  score: number;
  scoreDetails: ScoreDetail[];
  timeRemaining: number;
  isPaused: boolean;
  isCompleted: boolean;
  isStarted: boolean;
  operationHistory: OperationRecord[];
  reportGenerated: boolean;
  startTime: number;
}

export interface GameRecord {
  levelId: string;
  score: number;
  completedAt: number;
  timeTaken: number;
  errors: string[];
  replayData: OperationRecord[];
}
