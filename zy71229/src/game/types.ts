export enum DataSource {
  HALL = 'hall',
  ART = 'art',
  DOOR = 'door',
  LIGHT = 'light',
  ROUTE = 'route',
  REPORT = 'report',
}

export enum AnomalyType {
  MISSED_CORNER = 'missed_corner',
  DOOR_FALSE_ALARM = 'door_false_alarm',
  ART_VIBRATION = 'art_vibration',
  LIGHT_ABNORMAL = 'light_abnormal',
}

export enum AnomalyStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FALSE_ALARM = 'false_alarm',
  IGNORED = 'ignored',
}

export interface Position {
  x: number;
  y: number;
}

export interface Hall {
  id: string;
  name: string;
  position: { x: number; y: number; width: number; height: number };
  corners: string[];
  isPatrolled: boolean;
  patrolTime: number | null;
}

export interface Corner {
  id: string;
  hallId: string;
  name: string;
  position: Position;
  isPatrolled: boolean;
  patrolTime: number | null;
}

export interface Artwork {
  id: string;
  name: string;
  hallId: string;
  position: Position;
  vibrationSensor: {
    enabled: boolean;
    threshold: number;
    currentValue: number;
    lastTriggered: number | null;
  };
}

// 门禁记录
export interface DoorAccessLog {
  id: string;
  timestamp: number;
  type: 'open' | 'close' | 'alarm' | 'unlock' | 'lock';
  source: DataSource.DOOR;
  details: string;
}

export interface Door {
  id: string;
  name: string;
  hallId: string;
  position: Position;
  status: 'open' | 'closed' | 'locked';
  lastAccess: number | null;
  accessLog: DoorAccessLog[];
  falseAlarmCount: number;
}

export interface Light {
  id: string;
  name: string;
  hallId: string;
  position: Position;
  status: 'on' | 'off' | 'dimmed' | 'fault';
  brightness: number;
  lastChanged: number;
}

export interface RouteNode {
  id: string;
  hallId: string;
  position: Position;
  type: 'hall' | 'corner' | 'door' | 'artwork';
  targetId: string;
  estimatedTime: number;
}

export interface AnomalyEvidence {
  source: DataSource;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  source: DataSource;
  relatedEntityId: string;
  triggerTime: number;
  detectedTime: number | null;
  resolvedTime: number | null;
  status: AnomalyStatus;
  playerChoice: AnomalyStatus | null;
  isTrueAnomaly: boolean;
  description: string;
  evidence: AnomalyEvidence[];
  correctAction: AnomalyStatus;
  explanation: string;
}

export interface Decision {
  id: string;
  timestamp: number;
  realTimestamp: number;
  anomalyId: string;
  choice: AnomalyStatus;
  evidenceUsed: DataSource[];
  timeSpent: number;
  isCorrect: boolean;
}

export interface ScoreItem {
  category: string;
  description: string;
  points: number;
  maxPoints: number;
}

export type ViewedDataSources = Record<DataSource, number[]>;

export interface GameState {
  id: string;
  startTime: number;
  endTime: number | null;
  gameTime: number;
  totalTime: number;
  timeScale: number;
  isPaused: boolean;
  isGameOver: boolean;
  currentPosition: Position;
  currentHallId: string | null;
  plannedRoute: RouteNode[];
  isMoving: boolean;
  moveTarget: Position | null;
  moveStartTime: number;
  moveDuration: number;
  halls: Hall[];
  corners: Corner[];
  artworks: Artwork[];
  doors: Door[];
  lights: Light[];
  anomalies: Anomaly[];
  decisions: Decision[];
  score: ScoreItem[];
  totalScore: number;
  viewedDataSources: ViewedDataSources;
  reportDraft: string;
  activeAnomalyId: string | null;
}

export interface GameStateSnapshot {
  timestamp: number;
  gameState: Partial<GameState>;
  eventType: 'tick' | 'decision' | 'anomaly_trigger' | 'move' | 'route_change';
}

export interface ReplayData {
  gameId: string;
  snapshots: GameStateSnapshot[];
  decisions: Decision[];
  anomalies: Anomaly[];
  halls: Hall[];
  corners: Corner[];
  artworks: Artwork[];
  doors: Door[];
  lights: Light[];
  finalScore: number;
  startTime: number;
  endTime: number;
}

export interface HistoryRecord {
  id: string;
  gameId: string;
  startTime: number;
  endTime: number;
  finalScore: number;
  totalAnomalies: number;
  correctDecisions: number;
  totalDecisions: number;
  replayDataId: string;
}

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  [DataSource.HALL]: '[展厅]',
  [DataSource.ART]: '[作品]',
  [DataSource.DOOR]: '[门禁]',
  [DataSource.LIGHT]: '[灯光]',
  [DataSource.ROUTE]: '[路线]',
  [DataSource.REPORT]: '[报告]',
};

export const DATA_SOURCE_COLORS: Record<DataSource, string> = {
  [DataSource.HALL]: 'border-source-hall text-source-hall',
  [DataSource.ART]: 'border-source-art text-source-art',
  [DataSource.DOOR]: 'border-source-door text-source-door',
  [DataSource.LIGHT]: 'border-source-light text-source-light',
  [DataSource.ROUTE]: 'border-source-route text-source-route',
  [DataSource.REPORT]: 'border-source-report text-source-report',
};

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  [AnomalyType.MISSED_CORNER]: '漏巡角落',
  [AnomalyType.DOOR_FALSE_ALARM]: '门禁告警',
  [AnomalyType.ART_VIBRATION]: '作品震动',
  [AnomalyType.LIGHT_ABNORMAL]: '灯光异常',
};

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  [AnomalyStatus.PENDING]: '待处理',
  [AnomalyStatus.CONFIRMED]: '确认异常',
  [AnomalyStatus.FALSE_ALARM]: '标记误报',
  [AnomalyStatus.IGNORED]: '忽略',
};
