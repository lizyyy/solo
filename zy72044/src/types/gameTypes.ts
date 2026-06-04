export interface Resources {
  time: number;
  energy: number;
  budget: number;
  [key: string]: number;
}

export type EventType = 'traffic_light' | 'road_condition' | 'weather' | 'other';

export interface GameEvent {
  id: string;
  name: string;
  type: EventType;
  description: string;
  resourceChanges: Partial<Resources>;
  source: string;
  timestamp?: number;
}

export interface Level {
  id: string;
  name: string;
  events: GameEvent[];
  isEmpty?: boolean;
}

export interface ResourceBoundary {
  min: number;
  max: number;
}

export interface GameConfig {
  id: string;
  name: string;
  initialResources: Resources;
  resourceBoundaries: Record<string, ResourceBoundary>;
  levels: Level[];
  source: string;
}

export type GameStatus = 'idle' | 'running' | 'paused' | 'finished' | 'error';

export interface GameRecord {
  id: string;
  configId: string;
  configName: string;
  startTime: number;
  endTime?: number;
  status: GameStatus;
  finalResources?: Resources;
  eventLog: GameEvent[];
  anomalies: string[];
  needsManualReview: boolean;
  dataFormatVersion: 'v1' | 'v2';
  source: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  emptyLevels: string[];
  duplicateEvents: string[];
  boundaryIssues: string[];
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export interface PlaybackState {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  currentIndex: number;
  totalEvents: number;
}

export type AppView = 'game' | 'report' | 'replay';
