export interface TrackingSchema {
  version: string;
  events: EventSchema[];
  commonFields: FieldDefinition[];
}

export interface EventSchema {
  name: string;
  description: string;
  version: string;
  fields: FieldDefinition[];
  required: string[];
  enumValues?: Record<string, string[]>;
}

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface TrackingEvent {
  event_id: string;
  event_name: string;
  timestamp: string;
  user_id: string;
  session_id: string;
  app_version: string;
  properties: Record<string, any>;
  [key: string]: any;
}

export interface RouteInfo {
  path: string;
  page_name: string;
  expected_events: string[];
  [key: string]: any;
}

export interface ReleaseChange {
  version: string;
  date: string;
  changes: ReleaseChangeItem[];
}

export interface ReleaseChangeItem {
  type: 'add' | 'remove' | 'rename' | 'modify';
  event?: string;
  field?: string;
  from?: string;
  to?: string;
  description: string;
}

export interface WarehouseSample {
  event_id: string;
  event_name: string;
  timestamp: string;
  user_id: string;
  session_id: string;
  [key: string]: any;
}

export interface CheckResult {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details?: any;
  event_id?: string;
  event_name?: string;
  timestamp?: string;
}

export interface FunnelStep {
  event_name: string;
  count: number;
  conversion_rate?: number;
  drop_off_rate?: number;
}

export interface FunnelAnalysis {
  funnel_name: string;
  steps: FunnelStep[];
  breakpoints: BreakpointInfo[];
  total_conversion_rate: number;
}

export interface BreakpointInfo {
  step_index: number;
  step_name: string;
  next_step_name: string;
  drop_off_count: number;
  drop_off_rate: number;
  affected_events: string[];
}

export interface DiffResult {
  category: string;
  in_client_only: string[];
  in_warehouse_only: string[];
  both: string[];
  mismatched: MismatchedEvent[];
}

export interface MismatchedEvent {
  event_id: string;
  client_event: Partial<TrackingEvent>;
  warehouse_event: Partial<WarehouseSample>;
  differences: string[];
}

export interface Report {
  generated_at: string;
  check_results: CheckResult[];
  funnel_analyses: FunnelAnalysis[];
  diff_results: DiffResult[];
  summary: ReportSummary;
}

export interface ReportSummary {
  total_events: number;
  total_errors: number;
  total_warnings: number;
  critical_issues: string[];
}

export interface AppContext {
  schema: TrackingSchema | null;
  events: TrackingEvent[];
  routes: RouteInfo[];
  releaseChanges: ReleaseChange[];
  warehouseSamples: WarehouseSample[];
}

export interface CommandOptions {
  output?: string;
  format?: 'json' | 'csv' | 'markdown';
  verbose?: boolean;
  filter?: string;
}
