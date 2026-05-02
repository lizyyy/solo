export interface WebrtcStat {
  timestamp: number;
  clientId: string;
  role: 'doctor' | 'patient';
  type: string;
  id: string;
  [key: string]: unknown;
}

export interface SignalingEvent {
  timestamp: number;
  clientId: string;
  role: 'doctor' | 'patient';
  eventType: string;
  [key: string]: unknown;
}

export interface ClinicRule {
  id: string;
  name: string;
  description: string;
  category: 'ice' | 'av_sync' | 'packet_loss' | 'jitter' | 'other';
  threshold?: number;
  duration?: number;
  enabled: boolean;
}

export interface ParsedData {
  webrtcStats: WebrtcStat[];
  signalingEvents: SignalingEvent[];
  rules: ClinicRule[];
}

export interface TimelineEvent {
  timestamp: number;
  clientId: string;
  role: 'doctor' | 'patient';
  type: string;
  data: unknown;
}

export interface QualityEvent {
  timestamp: number;
  clientId: string;
  role: 'doctor' | 'patient';
  ruleId: string;
  ruleName: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value?: number;
  threshold?: number;
}

export interface AlignedTimeline {
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
  duration: number;
}

export interface CallReport {
  callId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  participants: {
    doctor: string[];
    patient: string[];
  };
  qualityEvents: QualityEvent[];
  summary: {
    totalEvents: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}
