export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

export type Severity = 'blocker' | 'warning' | 'info';

export type ImpactLevel = 'caller-must-change' | 'attention-only' | 'ignorable';

export type ChangeType =
  | 'path_deleted'
  | 'path_added'
  | 'path_method_changed'
  | 'request_param_required_added'
  | 'request_param_required_removed'
  | 'request_param_type_changed'
  | 'request_body_required_added'
  | 'request_body_required_removed'
  | 'request_body_field_deleted'
  | 'request_body_field_added'
  | 'request_body_field_type_changed'
  | 'response_status_added'
  | 'response_status_deleted'
  | 'response_field_deleted'
  | 'response_field_added'
  | 'response_field_type_changed'
  | 'enum_value_removed'
  | 'enum_value_added'
  | 'error_code_added'
  | 'error_code_removed'
  | 'error_code_description_changed';

export interface ServiceOwner {
  serviceName: string;
  owners: string[];
  email?: string;
  slackChannel?: string;
}

export interface ServiceConfig {
  serviceName: string;
  oldContractPath: string;
  newContractPath: string;
  samplesPath?: string;
  owners: string[];
}

export interface CliConfig {
  services: ServiceConfig[];
  exemptionsPath?: string;
  confirmationsPath?: string;
  outputDir?: string;
}

export interface ParsedOpenAPI {
  serviceName: string;
  version: string;
  paths: ParsedPath[];
  schemas: Record<string, ParsedSchema>;
}

export interface ParsedPath {
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
}

export interface ParsedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  schema?: ParsedSchema;
  description?: string;
}

export interface ParsedRequestBody {
  required: boolean;
  content: Record<string, ParsedSchema>;
  description?: string;
}

export interface ParsedResponse {
  statusCode: string;
  description?: string;
  content: Record<string, ParsedSchema>;
}

export interface ParsedSchema {
  type?: string;
  $ref?: string;
  properties?: Record<string, ParsedSchema>;
  required?: string[];
  items?: ParsedSchema;
  enum?: string[];
  nullable?: boolean;
  additionalProperties?: boolean | ParsedSchema;
  allOf?: ParsedSchema[];
  anyOf?: ParsedSchema[];
  oneOf?: ParsedSchema[];
  description?: string;
}

export interface ContractDiff {
  id: string;
  serviceName: string;
  path: string;
  method: HttpMethod;
  changeType: ChangeType;
  field?: string;
  oldValue?: string;
  newValue?: string;
  description: string;
  severity: Severity;
  impact: ImpactLevel;
  affectedEnumValues?: string[];
  affectedResponseCodes?: string[];
}

export interface CallSample {
  serviceName?: string;
  path?: string;
  method?: string;
  operationId?: string;
  requestBody?: any;
  responseBody?: any;
  source: string;
  lineNumber?: number;
}

export interface SampleAnalysis {
  sample: CallSample;
  issues: SampleIssue[];
}

export interface SampleIssue {
  type: 'missing_operation' | 'uses_deleted_field' | 'uses_removed_enum';
  field?: string;
  path: string;
  method?: string;
  operationId?: string;
  description: string;
}

export interface Exemption {
  id: string;
  serviceName: string;
  path: string;
  method: HttpMethod;
  field?: string;
  changeType?: ChangeType;
  reason: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
}

export interface Confirmation {
  id: string;
  diffId: string;
  serviceName: string;
  path: string;
  method: HttpMethod;
  changeType: ChangeType;
  field?: string;
  confirmedBy: string;
  confirmedAt: string;
  notes?: string;
  changeHash: string;
}

export interface Anomaly {
  type: 'invalid_contract' | 'missing_operation_id' | 'owner_conflict' | 'invalid_sample' | 'invalid_exemption' | 'invalid_confirmation';
  serviceName?: string;
  path?: string;
  method?: string;
  message: string;
  details?: any;
  source: string;
}

export interface FilterOptions {
  services?: string[];
  paths?: string[];
  methods?: HttpMethod[];
  owners?: string[];
  severities?: Severity[];
  impacts?: ImpactLevel[];
}

export interface ScanResult {
  summary: ScanSummary;
  diffs: ContractDiff[];
  sampleAnalyses: SampleAnalysis[];
  anomalies: Anomaly[];
  exemptions: Exemption[];
  confirmations: Confirmation[];
  filteredDiffs: ContractDiff[];
}

export interface ScanSummary {
  totalServices: number;
  totalPaths: number;
  totalDiffs: number;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  callerMustChangeCount: number;
  attentionOnlyCount: number;
  ignorableCount: number;
  samplesAnalyzed: number;
  sampleIssues: number;
  anomaliesCount: number;
  exemptedCount: number;
  confirmedCount: number;
  hasBlockers: boolean;
}
