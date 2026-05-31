export type TimeFormat = 'UTC' | 'BEIJING' | 'RELATIVE';

export type CommandType = 'POWER_ON' | 'POWER_OFF' | 'CONFIG' | 'DATA_TRANSFER' | 'CALIBRATION' | 'STANDBY';

export type AnomalyType = 'WINDOW_OVERLAP' | 'TELEMETRY_MISSING' | 'MANUAL_INSERT';

export type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

export type CommandStatus = 'SCHEDULED' | 'EXECUTING' | 'COMPLETED' | 'SKIPPED';

export type AdjustType = 'INSERT' | 'MOVE' | 'DELETE';

export interface TimePoint {
  utc: Date;
  beijing: Date;
  relativeSeconds: number;
}

export interface Adjustment {
  id: string;
  commandId: string;
  adjustType: AdjustType;
  originalTime?: TimePoint;
  newTime: TimePoint;
  operator: string;
  reason: string;
  adjustTime: Date;
}

export interface Anomaly {
  id: string;
  commandId: string;
  anomalyType: AnomalyType;
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
  relatedCommands: string[];
  relativeTimeSeconds: number;
}

export interface Command {
  id: string;
  sequenceId: string;
  payloadName: string;
  commandName: string;
  commandType: CommandType;
  time: TimePoint;
  durationSeconds: number;
  reason: string;
  prerequisites: string[];
  status: CommandStatus;
  isManualInsert: boolean;
  adjustments: Adjustment[];
  anomaly?: Anomaly;
}

export interface TimeWindow {
  id: string;
  name: string;
  startTime: TimePoint;
  endTime: TimePoint;
  payload: string;
  windowType: string;
  commands: string[];
}

export interface TaskSequence {
  id: string;
  name: string;
  missionName: string;
  missionStartTime: Date;
  commands: Command[];
  windows: TimeWindow[];
  adjustments: Adjustment[];
}

export interface RecalculateResult {
  affectedCommands: string[];
  timeOffset: number;
  newWindows: TimeWindow[];
  report: string;
}

export interface BriefingData {
  missionName: string;
  sequenceName: string;
  generateTime: Date;
  totalCommands: number;
  anomalySummary: {
    windowOverlap: number;
    telemetryMissing: number;
    manualInsert: number;
  };
  criticalAnomalies: Anomaly[];
  adjustmentHistory: Adjustment[];
  suggestions: string[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  startTime: number;
  endTime: number;
  zoom: number;
  pan: number;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  commandId: string | null;
}
