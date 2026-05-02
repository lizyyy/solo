export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTime: number;
  endTime: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

export interface SpanStatus {
  code: number;
  message?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  rootSpan?: Span;
  startTime: number;
  endTime: number;
}

export interface ServiceMap {
  services: Service[];
  connections: ServiceConnection[];
}

export interface Service {
  name: string;
  type: string;
}

export interface ServiceConnection {
  from: string;
  to: string;
}

export interface SamplingRule {
  name: string;
  type: 'head' | 'tail';
  conditions: SamplingCondition[];
  action: 'keep' | 'drop';
  probability?: number;
  rateLimit?: number;
  errorsOnly?: boolean;
  latencyThreshold?: number;
}

export interface SamplingCondition {
  attribute: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists';
  value: unknown;
}

export interface SamplingResult {
  traceId: string;
  action: 'keep' | 'drop';
  reason: string;
  matchedRule?: string;
  affectedSpans: string[];
  droppedSpans: string[];
  blindPaths: BlindPath[];
}

export interface BlindPath {
  path: string[];
  errorType?: string;
  lastSpan?: string;
}

export interface ReplayReport {
  summary: ReportSummary;
  keptTraces: string[];
  droppedTraces: string[];
  blindPaths: BlindPathReport[];
  mixedSamplingTraces: MixedSamplingReport[];
  orphanSpanTraces: OrphanSpanReport[];
  clockSkewWarnings: ClockSkewWarning[];
}

export interface ReportSummary {
  totalTraces: number;
  keptTraces: number;
  droppedTraces: number;
  mixedSamplingTraces: number;
  orphanSpanTraces: number;
  tracesWithBlindPaths: number;
  totalSpans: number;
  keptSpans: number;
  droppedSpans: number;
}

export interface BlindPathReport {
  traceId: string;
  paths: BlindPath[];
}

export interface MixedSamplingReport {
  traceId: string;
  headResult?: 'keep' | 'drop';
  tailResult?: 'keep' | 'drop';
  description: string;
}

export interface OrphanSpanReport {
  traceId: string;
  orphanSpans: string[];
  parentSpanIds: string[];
}

export interface ClockSkewWarning {
  traceId: string;
  spanId: string;
  issue: 'clock倒退' | 'end_before_start' | 'parent_end_after_child';
  details: string;
}