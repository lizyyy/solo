export interface MqttMessage {
  id: string;
  timestamp: number;
  topic: string;
  payload: string;
  qos: 0 | 1 | 2;
  retain: boolean;
  dup: boolean;
  direction: 'in' | 'out';
  clientId: string;
}

export interface DeviceShadow {
  deviceId: string;
  version: number;
  state: {
    reported: Record<string, unknown>;
    desired: Record<string, unknown>;
  };
  metadata: {
    reported: Record<string, { timestamp: number }>;
    desired: Record<string, { timestamp: number }>;
  };
  timestamp: number;
}

export interface DeviceConfig {
  deviceId: string;
  name: string;
  type: string;
  shadowVersion: number;
  desiredConfig: Record<string, unknown>;
  lastSeen: number;
  status: 'online' | 'offline' | 'unknown';
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: {
    type: 'threshold' | 'state_change' | 'timeout' | 'custom';
    parameters: Record<string, unknown>;
  };
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  topicPattern: string;
}

export interface ParsedLog {
  messages: MqttMessage[];
  errors: ParseError[];
}

export interface ParseError {
  lineNumber: number;
  rawLine: string;
  error: string;
  timestamp: number;
}

export interface Session {
  clientId: string;
  connected: boolean;
  connectTime?: number;
  disconnectTime?: number;
  subscriptions: string[];
  pendingMessages: PendingMessage[];
}

export interface PendingMessage {
  messageId: string;
  message: MqttMessage;
  qos: 0 | 1 | 2;
  state: 'pending' | 'acknowledged' | 'received' | 'complete';
  retries: number;
  lastSent: number;
}

export interface ReplayEvent {
  timestamp: number;
  type: 'connect' | 'disconnect' | 'subscribe' | 'unsubscribe' | 'publish' | 'message';
  clientId: string;
  details: Record<string, unknown>;
  originalMessage?: MqttMessage;
}

export interface ReplayResult {
  events: ReplayEvent[];
  retainedMessages: Map<string, MqttMessage>;
  sessions: Map<string, Session>;
  deviceShadows: Map<string, DeviceShadow>;
}

export interface Violation {
  id: string;
  type: 'version_regression' | 'duplicate_command' | 'expired_shadow' | 'missed_alert' | 'retain_override';
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
  deviceId?: string;
  message: string;
  details: {
    expected?: unknown;
    actual?: unknown;
    relatedMessages?: string[];
    context?: Record<string, unknown>;
  };
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
}

export interface ReviewDecision {
  id: string;
  violationId: string;
  decision: 'accept' | 'reject' | 'need_more_info';
  reason: string;
  reviewer: string;
  timestamp: number;
  attachments?: string[];
}

export interface AuditReport {
  reportId: string;
  generatedAt: number;
  period: {
    start: number;
    end: number;
  };
  summary: {
    totalMessages: number;
    totalDevices: number;
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
  };
  violations: Violation[];
  reviews: ReviewDecision[];
  deviceStatuses: Map<string, DeviceConfig>;
  retainedMessages: Map<string, {
    topic: string;
    payload: string;
    version: number;
    lastUpdated: number;
  }>;
}

export type ExportFormat = 'markdown' | 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeDetails: boolean;
  includeViolations: boolean;
  includeReviews: boolean;
  includeDeviceStatus: boolean;
}

export interface ImportValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  stats: {
    messages: number;
    devices: number;
    rules: number;
  };
}