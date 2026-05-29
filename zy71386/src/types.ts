export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

export interface FieldSchema {
  name: string;
  type: FieldType;
  nullable: boolean;
  required: boolean;
  enum?: string[];
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
  description?: string;
}

export interface EndpointSchema {
  path: string;
  method: string;
  summary?: string;
  tags?: string[];
  requestBody?: FieldSchema;
  responses: Record<string, FieldSchema>;
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    type: FieldType;
    required: boolean;
    enum?: string[];
  }>;
}

export interface ApiContract {
  version: string;
  source: 'openapi' | 'mock' | 'real';
  sourceName: string;
  endpoints: EndpointSchema[];
  generatedAt: string;
}

export type DiffSeverity = 'breaking' | 'warning' | 'info';
export type DiffType = 
  | 'field_added'
  | 'field_removed'
  | 'type_changed'
  | 'nullable_changed'
  | 'required_changed'
  | 'enum_added'
  | 'enum_removed'
  | 'endpoint_added'
  | 'endpoint_removed'
  | 'parameter_added'
  | 'parameter_removed'
  | 'response_code_added'
  | 'response_code_removed';

export interface FieldDiff {
  type: DiffType;
  path: string;
  field: string;
  expected?: unknown;
  actual?: unknown;
  severity: DiffSeverity;
  source?: {
    file?: string;
    line?: number;
    context?: string;
  };
}

export interface EndpointDiff {
  path: string;
  method: string;
  type?: DiffType;
  severity: DiffSeverity;
  fieldDiffs: FieldDiff[];
  source?: {
    file?: string;
    line?: number;
  };
}

export interface ContractDiffResult {
  contractA: ApiContract;
  contractB: ApiContract;
  timestamp: string;
  summary: {
    totalDiffs: number;
    breakingChanges: number;
    warnings: number;
    infos: number;
    isCompatible: boolean;
  };
  endpointDiffs: EndpointDiff[];
  missingEndpoints: EndpointSchema[];
  newEndpoints: EndpointSchema[];
}

export interface VersionRecord {
  version: string;
  contract: ApiContract;
  timestamp: string;
  changes: string[];
  parentVersion?: string;
}

export interface ReportOptions {
  format: 'json' | 'html' | 'markdown';
  outputPath?: string;
  includeExamples?: boolean;
  includeSchema?: boolean;
}

export interface CompatibilityCheckOptions {
  allowNewOptionalFields: boolean;
  allowNewEnumValues: boolean;
  allowNewEndpoints: boolean;
  allowNewResponseCodes: boolean;
}
