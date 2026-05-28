export interface GroundStation {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  latitude: number;
  longitude: number;
  bandwidth: number;
  bands: string[];
  antennaSlewTime: number;
  antennaDiameter: number;
  status: 'idle' | 'active' | 'slewing' | 'error';
}

export interface Probe {
  id: string;
  name: string;
  orbitParams: {
    semiMajorAxis: number;
    eccentricity: number;
    inclination: number;
    raan: number;
  };
  dataStorage: number;
  commandBufferSize: number;
  currentDataUsage: number;
}

export interface VisibilityWindow {
  id: string;
  groundStationId: string;
  probeId: string;
  startTime: number;
  endTime: number;
  maxElevation: number;
  predictedDuration: number;
  duration: number;
  actualDuration?: number;
  bands: string[];
  status: 'predicted' | 'active' | 'completed' | 'missed';
}

export interface DataPacket {
  id: string;
  probeId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  priorityLevel: number;
  size: number;
  dataType: 'science' | 'engineering' | 'telemetry';
  description: string;
  deadline: number;
  createdAt: number;
  isDownloaded: boolean;
  downloadWindowId?: string;
  lossPenalty: number;
}

export interface Command {
  id: string;
  name: string;
  priority: 1 | 2 | 3 | 4 | 5;
  priorityLabel: 'critical' | 'high' | 'medium' | 'low';
  size: number;
  timeout: number;
  timeToLive: number;
  description: string;
  failureImpact: string;
  isSent: boolean;
  sentTime?: number;
  windowId?: string;
  status: 'pending' | 'queued' | 'transmitting' | 'success' | 'timeout' | 'failed';
  transmittedPercent?: number;
}

export interface CommandQueue {
  groundStationId: string;
  commands: string[];
  currentIndex: number;
}

export type EventType =
  | 'window_start'
  | 'window_end'
  | 'window_missed'
  | 'command_sent'
  | 'command_timeout'
  | 'command_failed'
  | 'data_download_start'
  | 'data_download_complete'
  | 'data_download_failed'
  | 'data_packet_lost'
  | 'ground_station_error'
  | 'storage_overflow'
  | 'link_degradation'
  | 'mission_start'
  | 'mission_end';

export interface EventLog {
  id: string;
  timestamp: number;
  type: EventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  relatedEntityId?: string;
  errorDetail?: ErrorDetail;
  scoreImpact?: number;
}

export interface ErrorDetail {
  errorType: 'window_missed' | 'command_timeout' | 'data_packet_lost';
  windowMissed?: {
    windowId: string;
    reason: 'wrong_station' | 'previous_overrun' | 'insufficient_slew_time' | 'prediction_error';
    scheduledTasks: string[];
  };
  commandTimeout?: {
    commandId: string;
    windowId: string;
    reason: 'queue_position' | 'size_too_large' | 'retransmission_needed' | 'solar_conjunction';
    queuePosition: number;
    transmittedPercent: number;
  };
  dataPacketLost?: {
    packetId: string;
    windowId: string;
    reason: 'bandwidth_exceeded' | 'rain_fade' | 'storage_overflow' | 'ground_storage_failure';
    recoveredPercent: number;
  };
}

export interface ScoreDetail {
  category: string;
  maxScore: number;
  earnedScore: number;
  description: string;
  breakdown: {
    label: string;
    value: number;
    maxValue: number;
  }[];
}

export interface ScoreBreakdown {
  dataDownload: number;
  commandDelivery: number;
  resourceUtilization: number;
  efficiencyBonus: number;
  errorPenalty: number;
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorsByType: Record<string, number>;
  deductionDetails: {
    type: string;
    totalDeduction: number;
    count: number;
    breakdown: { reason: string; count: number; deduction: number }[];
  }[];
}

export interface MissionReport {
  reportId: string;
  missionId: string;
  missionName: string;
  startTime: number;
  endTime: number;
  completedAt: number;
  finalScore: number;
  maxScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  scoreBreakdown: ScoreBreakdown;
  scoreDetails: ScoreDetail[];
  statistics: {
    windowUtilization: number;
    dataCompletionRate: number;
    commandSuccessRate: number;
    totalErrors: number;
  };
  errorAnalysis: ErrorAnalysis;
  eventSummary: {
    totalEvents: number;
    errorsByType: Record<string, number>;
    criticalErrors: string[];
  };
  performanceMetrics: {
    dataDownloadRate: number;
    commandSuccessRate: number;
    windowUtilization: number;
    resourceEfficiency: number;
  };
  recommendations: string[];
  timelineData: EventLog[];
}

export interface GameState {
  missionId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentTime: number;
  speed: number;
  groundStations: GroundStation[];
  probe: Probe;
  visibilityWindows: VisibilityWindow[];
  dataPackets: DataPacket[];
  commands: Command[];
  queues: Record<string, CommandQueue>;
}

export interface ScheduleBlock {
  id: string;
  windowId: string;
  stationId: string;
  startTime: number;
  endTime: number;
  type: 'download' | 'command';
  taskIds: string[];
}

export interface MissionConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
  duration: number;
  maxScore: number;
  scoreMultiplier: number;
  errorMultiplier: number;
  groundStationIds: string[];
  probeId: string;
  probes: Probe[];
  visibilityWindows: VisibilityWindow[];
  dataPackets: DataPacket[];
  commands: Command[];
  initialPackets: string[];
  initialCommands: string[];
}
