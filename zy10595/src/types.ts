export interface EnumValue {
  value: string | number;
  source: string;
  line?: number;
  column?: number;
}

export interface EnumDefinition {
  name: string;
  values: EnumValue[];
  source: 'openapi' | 'source';
  filePath: string;
  rawContent?: string;
}

export interface EnumDiff {
  enumName: string;
  onlyInOpenApi: EnumValue[];
  onlyInSource: EnumValue[];
  mismatch?: {
    openApi: EnumValue[];
    source: EnumValue[];
  };
}

export interface BadEntry {
  filePath: string;
  line?: number;
  column?: number;
  rawContent: string;
  reason: string;
  severity: 'error' | 'warning';
}

export interface ProcessingError {
  filePath: string;
  error: string;
  timestamp: Date;
}

export interface EnumReport {
  summary: {
    totalEnums: number;
    matchedEnums: number;
    mismatchedEnums: number;
    totalBadEntries: number;
    errors: number;
    warnings: number;
  };
  differences: EnumDiff[];
  badEntries: BadEntry[];
  errors: ProcessingError[];
  timestamp: Date;
  metadata: {
    openApiFiles: string[];
    sourceFiles: string[];
  };
}

export interface CliOptions {
  openapi: string[];
  source: string[];
  enumNames?: string[];
  output?: string;
  format: 'json' | 'markdown' | 'terminal';
  failOnError: boolean;
  keepBadEntries: boolean;
}
