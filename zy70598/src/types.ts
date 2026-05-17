export interface WebSocketFrame {
  raw: string;
  lineNumber: number;
  timestamp: number;
  timestampStr: string;
  connectionId: string;
  direction: 'in' | 'out' | 'unknown';
  opcode: string;
  payload: string;
  isValid: boolean;
  parseError?: string;
}

export interface StateSnapshot {
  frameIndex: number;
  timestamp: number;
  state: Record<string, any>;
  frame: WebSocketFrame;
}

export interface Anomaly {
  type: 'parse_error' | 'state_change' | 'timeout' | 'unexpected_frame' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  frameIndex: number;
  frame: WebSocketFrame;
  message: string;
  details?: Record<string, any>;
}

export interface StateDiff {
  frameIndex: number;
  path: string;
  oldValue: any;
  newValue: any;
  operation: 'add' | 'remove' | 'update';
}

export interface ReplayResult {
  meta: {
    inputFile: string;
    totalLines: number;
    validFrames: number;
    invalidFrames: number;
    startTime: number;
    endTime: number;
    durationMs: number;
  };
  frames: WebSocketFrame[];
  stateSnapshots: StateSnapshot[];
  anomalies: Anomaly[];
  stateDiffs: StateDiff[];
  finalState: Record<string, any>;
}

export interface ReportOutput {
  terminal: string;
  machineReadable: string;
  html: string;
}

export interface ParseOptions {
  timeFormat?: string;
  connectionIdField?: string;
  payloadEncoding?: 'json' | 'base64' | 'plain';
}

export interface ReplayOptions extends ParseOptions {
  initialState?: Record<string, any>;
  stateExtractor?: (frame: WebSocketFrame, currentState: Record<string, any>) => Record<string, any>;
  anomalyRules?: AnomalyRule[];
}

export interface AnomalyRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (frame: WebSocketFrame, state: Record<string, any>, index: number) => boolean;
  message: string;
}
