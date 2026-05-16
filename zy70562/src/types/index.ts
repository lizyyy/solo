export interface PrometheusRule {
  alert: string;
  expr: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface RuleGroup {
  name: string;
  rules: PrometheusRule[];
}

export interface RulesFile {
  groups: RuleGroup[];
}

export interface LabelExtraction {
  metricName: string;
  labels: string[];
  aggregationLabels?: string[];
  byLabels?: string[];
  withoutLabels?: string[];
}

export interface AnnotationPlaceholder {
  name: string;
  fullMatch: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  ruleName: string;
  groupName: string;
  filePath: string;
  line?: number;
  column?: number;
  rawContent?: string;
}

export interface SampleEvaluation {
  labels: Record<string, string>;
  value: number;
  triggersAlert: boolean;
  annotationRendered?: Record<string, string>;
}

export interface RuleValidationResult {
  ruleName: string;
  groupName: string;
  filePath: string;
  expr: string;
  parsedLabels?: LabelExtraction;
  annotationPlaceholders?: AnnotationPlaceholder[];
  issues: ValidationIssue[];
  sampleEvaluations?: SampleEvaluation[];
}

export interface LintResult {
  summary: {
    totalRules: number;
    totalGroups: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    infos: number;
    rulesWithIssues: number;
  };
  results: RuleValidationResult[];
  files: string[];
  timestamp: string;
  version: string;
}

export interface CliOptions {
  input: string;
  output?: string;
  format?: 'json' | 'markdown' | 'both';
  samples?: string;
  verbose?: boolean;
  failOnError?: boolean;
}
