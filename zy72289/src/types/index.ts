export type ObstacleStatus = 'normal' | 'pending_review' | 'conflict' | 'corrected';

export interface PointCloudLog {
  id: string;
  deviceId: string;
  deviceName: string;
  thinningParams: {
    voxelSize: number;
    maxPoints: number;
    quality: string;
  };
  detectedObstacles: DetectedObstacle[];
  importTime: string;
  operator: string;
  status: 'imported' | 'reviewed' | 'corrected';
  scenarioType: 'normal' | 'duplicate_name' | 'old_caliber';
}

export interface DetectedObstacle {
  id: string;
  name: string;
  alias?: string;
  position: { x: number; y: number; z: number };
  detectedRadius: number;
  status: ObstacleStatus;
  conflictNote?: string;
  correctedRadius?: number;
  deviceId?: string;
  voltageLevel?: string;
  manualNote?: string;
}

export interface SafetyRadiusEntry {
  id: string;
  deviceId: string;
  deviceName: string;
  voltageLevel: string;
  oldRadius: number;
  newRadius: number;
  version: string;
  effectiveDate: string;
  isCurrent: boolean;
  hasConflict?: boolean;
}

export type ActionType = 'import_log' | 'check_radius' | 'manual_correct' | 're_run' | 'mark_review' | 'update_annotation' | 'add_note';

export interface HistoryRecord {
  id: string;
  timestamp: string;
  actionType: ActionType;
  operator: string;
  description: string;
  affectedObstacleIds: string[];
  snapshot: {
    obstacles: DetectedObstacle[];
  };
}

export type CurrentStep = 1 | 2 | 3;
export type ScenarioType = 'normal' | 'duplicate_name' | 'old_caliber' | null;

export interface AppState {
  currentStep: CurrentStep;
  pointCloudLogs: PointCloudLog[];
  safetyRadiusTable: SafetyRadiusEntry[];
  historyRecords: HistoryRecord[];
  activeObstacleId: string | null;
  scenarioType: ScenarioType;
  isDemoRunning: boolean;
}

export interface AppActions {
  importLog: (scenarioType: ScenarioType) => void;
  checkRadiusTable: () => void;
  updateAnnotation: () => void;
  manualCorrect: (obstacleId: string, newRadius: number) => void;
  markForReview: (obstacleId: string) => void;
  addManualNote: (obstacleId: string, note: string) => void;
  reRun: () => void;
  resetDemo: () => void;
  selectObstacle: (id: string | null) => void;
  setScenarioType: (type: ScenarioType) => void;
  setIsDemoRunning: (running: boolean) => void;
}

export type AppStore = AppState & AppActions;

export const statusColors: Record<ObstacleStatus, string> = {
  normal: '#38a169',
  pending_review: '#d69e2e',
  conflict: '#e53e3e',
  corrected: '#805ad5',
};

export const statusLabels: Record<ObstacleStatus, string> = {
  normal: '正常',
  pending_review: '待复核',
  conflict: '口径冲突',
  corrected: '已修正',
};
