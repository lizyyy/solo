export interface CLIOptions {
  input: string;
  output?: string;
  rules?: string;
  format?: 'json' | 'html' | 'both';
  verbose?: boolean;
  failFast?: boolean;
}

export interface FuzzRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'null' | 'array-shuffle' | 'array-sort' | 'array-reverse' | 'empty-string' | 'extra-field' | 'missing-field' | 'type-change';
  target?: string;
  priority: number;
}

export interface SchemaLocation {
  path: string;
  method?: string;
  statusCode?: string;
  mediaType?: string;
  jsonPath: string;
  line?: number;
  column?: number;
}

export interface OriginalSample {
  value: any;
  location: SchemaLocation;
  schemaPath: string;
}

export interface PerturbedSample {
  id: string;
  original: OriginalSample;
  perturbedValue: any;
  ruleId: string;
  ruleName: string;
  perturbationDescription: string;
}

export interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  message?: string;
  params: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sample: PerturbedSample;
  durationMs: number;
}

export interface CoverageStats {
  totalRules: number;
  appliedRules: number;
  totalSamples: number;
  perturbedSamples: number;
  schemaPathsCovered: string[];
  ruleCoverage: Record<string, number>;
}

export interface FuzzReport {
  metadata: {
    timestamp: string;
    version: string;
    inputFile: string;
    command: string;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
    durationMs: number;
  };
  coverage: CoverageStats;
  failures: ValidationResult[];
  allResults: ValidationResult[];
  rules: FuzzRule[];
}

export interface OpenAPISchema {
  openapi: string;
  info: any;
  paths?: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
    requestBodies?: Record<string, any>;
  };
}

export interface SchemaWithLocation {
  schema: any;
  location: SchemaLocation;
  example?: any;
  examples?: Record<string, any>;
}
