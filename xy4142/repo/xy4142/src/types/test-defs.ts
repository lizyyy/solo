import { PluginManifest } from './manifest';

export interface TestBatch {
  id: string;
  name: string;
  description: string;
  pluginId: string;
  pluginVersion: string;
  createdAt: number;
  testCases: TestCase[];
  expectedResults?: ExpectedResult[];
  metadata: Record<string, unknown>;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  input: TestCaseInput;
  expected?: ExpectedValue;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface TestCaseInput {
  format: 'json' | 'binary' | 'protobuf';
  data: unknown;
  sizeBytes?: number;
  encoding?: string;
}

export interface ExpectedValue {
  type: 'exact' | 'range' | 'pattern' | 'custom';
  value: unknown;
  tolerance?: number;
  description?: string;
}

export interface ExpectedResult {
  testCaseId: string;
  expected: ExpectedValue;
  validationRules: ValidationRule[];
}

export interface ValidationRule {
  field: string;
  type: 'exact' | 'range' | 'contains' | 'regex' | 'custom';
  expected: unknown;
  tolerance?: number;
  message?: string;
}

export interface ExecutionResult {
  testCaseId: string;
  status: ExecutionStatus;
  output: ExecutionOutput;
  metrics: ExecutionMetrics;
  errors: ExecutionError[];
  warnings: string[];
  startedAt: number;
  completedAt: number;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'memory_exceeded' | 'error';

export interface ExecutionOutput {
  raw: Uint8Array | string;
  parsed: unknown;
  format: 'json' | 'binary' | 'protobuf';
  sizeBytes: number;
}

export interface ExecutionMetrics {
  durationMs: number;
  cpuTimeMs: number;
  memoryUsedBytes: number;
  memoryPeakBytes: number;
  instructionsExecuted: number;
}

export interface ExecutionError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface BatchExecutionResult {
  id: string;
  batchId: string;
  pluginId: string;
  pluginVersion: string;
  status: ExecutionStatus;
  results: ExecutionResult[];
  summary: BatchSummary;
  startedAt: number;
  completedAt: number;
}

export interface BatchSummary {
  total: number;
  passed: number;
  failed: number;
  timeout: number;
  errors: number;
  avgDurationMs: number;
  maxDurationMs: number;
  avgMemoryBytes: number;
  maxMemoryBytes: number;
}
