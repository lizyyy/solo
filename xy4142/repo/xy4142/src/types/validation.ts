import { ExecutionResult, TestCase } from './test-defs';

export interface ValidationContext {
  validationId: string;
  pluginId: string;
  pluginVersion: string;
  batchId: string;
  startedAt: number;
  options: ValidationOptions;
}

export interface ValidationOptions {
  schemaValidation: boolean;
  versionValidation: boolean;
  outputComparison: boolean;
  performanceThresholds: PerformanceThresholds;
  errorCodeValidation: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface PerformanceThresholds {
  maxDurationMs?: number;
  maxMemoryBytes?: number;
  maxCpuTimeMs?: number;
  maxInstructions?: number;
}

export interface TestValidationResult {
  testCaseId: string;
  valid: boolean;
  checkResults: CheckResult[];
  executionResult: ExecutionResult;
  validatedAt: number;
}

export interface CheckResult {
  type: CheckType;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
  durationMs?: number;
}

export type CheckType = 'schema_input' | 'schema_output' | 'version_compatibility' | 'output_match' |
  'performance_duration' | 'performance_memory' | 'performance_cpu' | 'error_code' | 'capability_usage';

export type CheckStatus = 'passed' | 'failed' | 'warning' | 'skipped' | 'error';

export interface BatchValidationResult {
  id: string;
  batchId: string;
  pluginId: string;
  pluginVersion: string;
  overallStatus: CheckStatus;
  testResults: TestValidationResult[];
  summary: ValidationSummary;
  startedAt: number;
  completedAt: number;
}

export interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  errors: number;
  byCheckType: Record<CheckType, { passed: number; failed: number; warnings: number }>;
  performance: {
    avgDurationMs: number;
    maxDurationMs: number;
    minDurationMs: number;
    avgMemoryBytes: number;
    maxMemoryBytes: number;
  };
}

export interface HumanReview {
  id: string;
  validationResultId: string;
  reviewer: string;
  reviewedAt: number;
  status: ReviewStatus;
  comments: ReviewComment[];
  finalDecision: ReviewDecision;
}

export type ReviewStatus = 'pending' | 'in_progress' | 'completed';

export interface ReviewComment {
  id: string;
  testCaseId?: string;
  checkType?: CheckType;
  comment: string;
  author: string;
  createdAt: number;
  attachments?: ReviewAttachment[];
}

export interface ReviewAttachment {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  dataRef: string;
}

export interface ReviewDecision {
  approved: boolean;
  reason: string;
  conditions?: string[];
  recommendedAction?: string;
}

export interface AuditPackage {
  id: string;
  generatedAt: number;
  generator: string;
  version: string;
  content: AuditContent;
}

export interface AuditContent {
  pluginManifest: Record<string, unknown>;
  testBatch: Record<string, unknown>;
  validationResult: Record<string, unknown>;
  humanReview?: Record<string, unknown>;
  systemInfo: SystemInfo;
}

export interface SystemInfo {
  platform: string;
  architecture: string;
  nodeVersion: string;
  validationEngineVersion: string;
  timestamp: number;
}
