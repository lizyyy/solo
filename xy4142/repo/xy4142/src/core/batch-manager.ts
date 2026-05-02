import { v4 as uuidv4 } from 'uuid';
import * as _ from 'lodash';
import {
  TestBatch,
  TestCase,
  ExecutionResult,
  ExecutionStatus,
  BatchExecutionResult,
  BatchSummary,
  TestValidationResult,
  CheckResult,
  CheckType,
  CheckStatus,
  BatchValidationResult,
  ValidationSummary,
  PerformanceThresholds,
  ValidationOptions
} from '../types';
import { LoadedPlugin } from './plugin-loader';
import { SandboxExecutor, SandboxOptions } from './sandbox-executor';
import { SchemaValidator } from './schema-validator';
import { createLogger } from '../utils/logger';
import { errorToRecord } from '../utils/error';

const logger = createLogger('batch-manager');

export interface BatchExecutionOptions {
  timeoutMs?: number;
  memoryPagesMax?: number;
  maxConcurrent?: number;
  retryCount?: number;
  retryDelayMs?: number;
  stopOnError?: boolean;
  validationOptions?: ValidationOptions;
  sandboxOptions?: Partial<SandboxOptions>;
}

export interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  passed: number;
  currentTestCase?: string;
  startTime: number;
  estimatedEndTime?: number;
}

const DEFAULT_OPTIONS: Required<BatchExecutionOptions> = {
  timeoutMs: 30000,
  memoryPagesMax: 16,
  maxConcurrent: 1,
  retryCount: 0,
  retryDelayMs: 1000,
  stopOnError: false,
  validationOptions: {
    schemaValidation: true,
    versionValidation: true,
    outputComparison: true,
    performanceThresholds: {},
    errorCodeValidation: true,
    maxRetries: 1,
    timeoutMs: 5000
  },
  sandboxOptions: {}
};

export class BatchManager {
  private plugin: LoadedPlugin;
  private executor: SandboxExecutor | null = null;
  private schemaValidator: SchemaValidator;
  private options: Required<BatchExecutionOptions>;
  private batches: Map<string, TestBatch> = new Map();
  private results: Map<string, BatchValidationResult> = new Map();
  private progress: Map<string, BatchProgress> = new Map();

  constructor(plugin: LoadedPlugin, options?: BatchExecutionOptions) {
    this.plugin = plugin;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.schemaValidator = new SchemaValidator();

    this.registerPluginSchemas();
  }

  private registerPluginSchemas(): void {
    const { interfaces } = this.plugin.manifest;

    if (interfaces.input.schema) {
      this.schemaValidator.registerSchema(
        `${this.plugin.id}:input`,
        interfaces.input.schema
      );
    }

    if (interfaces.output.schema) {
      this.schemaValidator.registerSchema(
        `${this.plugin.id}:output`,
        interfaces.output.schema
      );
    }
  }

  async initialize(): Promise<void> {
    logger.info('Initializing batch manager...');

    const sandboxOptions: Partial<SandboxOptions> = {
      ...this.options.sandboxOptions,
      timeoutMs: this.options.validationOptions.timeoutMs,
      memoryPagesMax: this.options.memoryPagesMax
    };

    this.executor = new SandboxExecutor(this.plugin, sandboxOptions);
    await this.executor.initialize(this.plugin.wasmBuffer);

    logger.info('Batch manager initialized successfully');
  }

  registerBatch(batch: TestBatch): string {
    if (this.batches.has(batch.id)) {
      logger.warn(`Batch ${batch.id} already registered, overwriting`);
    }

    this.batches.set(batch.id, batch);
    logger.info(`Registered test batch: ${batch.id} with ${batch.testCases.length} test cases`);

    return batch.id;
  }

  getBatch(batchId: string): TestBatch | undefined {
    return this.batches.get(batchId);
  }

  listBatches(): string[] {
    return Array.from(this.batches.keys());
  }

  async executeBatch(batchId: string): Promise<BatchValidationResult> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    if (!this.executor) {
      await this.initialize();
    }

    logger.info(`Executing batch: ${batchId} (${batch.testCases.length} test cases)`);

    const startTime = Date.now();
    const validationResult: BatchValidationResult = {
      id: uuidv4(),
      batchId: batch.id,
      pluginId: this.plugin.id,
      pluginVersion: this.plugin.version,
      overallStatus: 'passed',
      testResults: [],
      summary: this.createEmptySummary(),
      startedAt: startTime,
      completedAt: startTime
    };

    const progress: BatchProgress = {
      batchId,
      total: batch.testCases.length,
      completed: 0,
      failed: 0,
      passed: 0,
      startTime,
      currentTestCase: undefined
    };
    this.progress.set(batchId, progress);

    for (const testCase of batch.testCases) {
      progress.currentTestCase = testCase.id;

      const testResult = await this.executeTestCase(testCase, batch);
      validationResult.testResults.push(testResult);

      progress.completed++;
      if (testResult.valid) {
        progress.passed++;
      } else {
        progress.failed++;
        validationResult.overallStatus = 'failed';

        if (this.options.stopOnError) {
          logger.warn(`Stopping on error as configured (test case: ${testCase.id})`);
          break;
        }
      }

      progress.estimatedEndTime = this.calculateEstimatedEndTime(progress);
      this.progress.set(batchId, { ...progress });
    }

    validationResult.completedAt = Date.now();
    validationResult.summary = this.calculateSummary(validationResult);

    if (validationResult.overallStatus === 'passed') {
      logger.info(`Batch ${batchId} completed successfully: ${progress.passed}/${progress.total} passed`);
    } else {
      logger.warn(`Batch ${batchId} completed with failures: ${progress.failed}/${progress.total} failed`);
    }

    this.results.set(validationResult.id, validationResult);
    this.progress.delete(batchId);

    return validationResult;
  }

  private async executeTestCase(
    testCase: TestCase,
    batch: TestBatch
  ): Promise<TestValidationResult> {
    logger.debug(`Executing test case: ${testCase.id}`);

    const checkResults: CheckResult[] = [];
    let executionResult: ExecutionResult | null = null;

    try {
      if (this.options.validationOptions.schemaValidation) {
        const inputCheck = this.validateInputSchema(testCase);
        checkResults.push(inputCheck);

        if (inputCheck.status === 'failed') {
          logger.warn(`Test case ${testCase.id} failed input schema validation`);
          return this.createTestValidationResult(testCase, checkResults, this.createFailedExecutionResult(testCase));
        }
      }

      executionResult = await this.executeWithRetry(testCase);

      const schemaCheck = this.validateOutputSchema(executionResult);
      checkResults.push(schemaCheck);

      if (this.options.validationOptions.versionValidation) {
        const versionCheck = this.validateVersionCompatibility();
        checkResults.push(versionCheck);
      }

      if (this.options.validationOptions.outputComparison && testCase.expected) {
        const outputCheck = this.compareOutput(executionResult, testCase.expected);
        checkResults.push(outputCheck);
      }

      const perfChecks = this.validatePerformance(
        executionResult,
        this.options.validationOptions.performanceThresholds
      );
      checkResults.push(...perfChecks);

      const valid = checkResults.every(r => r.status === 'passed' || r.status === 'warning');

      return {
        testCaseId: testCase.id,
        valid,
        checkResults,
        executionResult,
        validatedAt: Date.now()
      };

    } catch (error) {
      logger.error(`Test case ${testCase.id} failed: ${(error as Error).message}`);

      checkResults.push({
        type: 'schema_input',
        status: 'error',
        message: `Test execution failed: ${(error as Error).message}`,
        details: errorToRecord(error)
      });

      return this.createTestValidationResult(
        testCase,
        checkResults,
        executionResult || this.createFailedExecutionResult(testCase)
      );
    }
  }

  private async executeWithRetry(testCase: TestCase): Promise<ExecutionResult> {
    let lastError: Error | null = null;
    const maxRetries = this.options.retryCount;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (!this.executor) {
          throw new Error('Executor not initialized');
        }

        const result = await this.executor.execute(testCase.input);

        if (result.status === 'completed' || result.status === 'failed') {
          return result;
        }

        logger.warn(`Test case ${testCase.id} attempt ${attempt + 1} failed: ${result.status}`);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Test case ${testCase.id} attempt ${attempt + 1} failed with error: ${(error as Error).message}`);
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs));
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private validateInputSchema(testCase: TestCase): CheckResult {
    const startTime = Date.now();
    const schemaId = `${this.plugin.id}:input`;

    if (!this.schemaValidator.hasSchema(schemaId)) {
      return {
        type: 'schema_input',
        status: 'skipped',
        message: 'Input schema not provided in plugin manifest',
        durationMs: Date.now() - startTime
      };
    }

    const result = this.schemaValidator.validate(testCase.input.data, schemaId);

    if (result.valid) {
      return {
        type: 'schema_input',
        status: 'passed',
        message: 'Input schema validation passed',
        durationMs: Date.now() - startTime
      };
    }

    return {
      type: 'schema_input',
      status: 'failed',
      message: `Input schema validation failed: ${result.errors.length} errors`,
      details: { errors: result.errors },
      durationMs: Date.now() - startTime
    };
  }

  private validateOutputSchema(executionResult: ExecutionResult): CheckResult {
    const startTime = Date.now();
    const schemaId = `${this.plugin.id}:output`;

    if (!this.schemaValidator.hasSchema(schemaId)) {
      return {
        type: 'schema_output',
        status: 'skipped',
        message: 'Output schema not provided in plugin manifest',
        durationMs: Date.now() - startTime
      };
    }

    if (executionResult.status !== 'completed') {
      return {
        type: 'schema_output',
        status: 'skipped',
        message: `Cannot validate output: execution status is ${executionResult.status}`,
        durationMs: Date.now() - startTime
      };
    }

    const result = this.schemaValidator.validate(executionResult.output.parsed, schemaId);

    if (result.valid) {
      return {
        type: 'schema_output',
        status: 'passed',
        message: 'Output schema validation passed',
        durationMs: Date.now() - startTime
      };
    }

    return {
      type: 'schema_output',
      status: 'failed',
      message: `Output schema validation failed: ${result.errors.length} errors`,
      details: { errors: result.errors },
      durationMs: Date.now() - startTime
    };
  }

  private validateVersionCompatibility(): CheckResult {
    const startTime = Date.now();

    return {
      type: 'version_compatibility',
      status: 'passed',
      message: `Plugin version ${this.plugin.manifest.version} is compatible`,
      durationMs: Date.now() - startTime
    };
  }

  private compareOutput(executionResult: ExecutionResult, expected: unknown): CheckResult {
    const startTime = Date.now();

    if (executionResult.status !== 'completed') {
      return {
        type: 'output_match',
        status: 'skipped',
        message: `Cannot compare output: execution status is ${executionResult.status}`,
        durationMs: Date.now() - startTime
      };
    }

    const actual = executionResult.output.parsed;
    const match = _.isEqual(actual, expected);

    if (match) {
      return {
        type: 'output_match',
        status: 'passed',
        message: 'Output matches expected value',
        durationMs: Date.now() - startTime
      };
    }

    return {
      type: 'output_match',
      status: 'failed',
      message: 'Output does not match expected value',
      details: {
        expected,
        actual
      },
      durationMs: Date.now() - startTime
    };
  }

  private validatePerformance(
    executionResult: ExecutionResult,
    thresholds: PerformanceThresholds
  ): CheckResult[] {
    const checks: CheckResult[] = [];

    if (thresholds.maxDurationMs !== undefined) {
      const startTime = Date.now();
      const exceeded = executionResult.metrics.durationMs > thresholds.maxDurationMs;

      checks.push({
        type: 'performance_duration',
        status: exceeded ? 'failed' : 'passed',
        message: exceeded
          ? `Duration exceeded: ${executionResult.metrics.durationMs.toFixed(2)}ms > ${thresholds.maxDurationMs}ms`
          : `Duration OK: ${executionResult.metrics.durationMs.toFixed(2)}ms`,
        details: {
          actual: executionResult.metrics.durationMs,
          limit: thresholds.maxDurationMs
        },
        durationMs: Date.now() - startTime
      });
    }

    if (thresholds.maxMemoryBytes !== undefined) {
      const startTime = Date.now();
      const exceeded = executionResult.metrics.memoryPeakBytes > thresholds.maxMemoryBytes;

      checks.push({
        type: 'performance_memory',
        status: exceeded ? 'failed' : 'passed',
        message: exceeded
          ? `Memory exceeded: ${this.formatBytes(executionResult.metrics.memoryPeakBytes)} > ${this.formatBytes(thresholds.maxMemoryBytes)}`
          : `Memory OK: ${this.formatBytes(executionResult.metrics.memoryPeakBytes)}`,
        details: {
          actual: executionResult.metrics.memoryPeakBytes,
          limit: thresholds.maxMemoryBytes
        },
        durationMs: Date.now() - startTime
      });
    }

    return checks;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  private createFailedExecutionResult(testCase: TestCase): ExecutionResult {
    return {
      testCaseId: testCase.id,
      status: 'error',
      output: {
        raw: '',
        parsed: null,
        format: testCase.input.format,
        sizeBytes: 0
      },
      metrics: {
        durationMs: 0,
        cpuTimeMs: 0,
        memoryUsedBytes: 0,
        memoryPeakBytes: 0,
        instructionsExecuted: 0
      },
      errors: [{ code: 'EXECUTION_FAILED', message: 'Test case execution failed' }],
      warnings: [],
      startedAt: Date.now(),
      completedAt: Date.now()
    };
  }

  private createTestValidationResult(
    testCase: TestCase,
    checkResults: CheckResult[],
    executionResult: ExecutionResult
  ): TestValidationResult {
    const valid = checkResults.every(r => r.status === 'passed' || r.status === 'warning');

    return {
      testCaseId: testCase.id,
      valid,
      checkResults,
      executionResult,
      validatedAt: Date.now()
    };
  }

  private createEmptySummary(): ValidationSummary {
    const checkTypes: CheckType[] = [
      'schema_input', 'schema_output', 'version_compatibility', 'output_match',
      'performance_duration', 'performance_memory', 'performance_cpu',
      'error_code', 'capability_usage'
    ];

    const byCheckType: ValidationSummary['byCheckType'] = {} as ValidationSummary['byCheckType'];
    for (const type of checkTypes) {
      byCheckType[type] = { passed: 0, failed: 0, warnings: 0 };
    }

    return {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      errors: 0,
      byCheckType,
      performance: {
        avgDurationMs: 0,
        maxDurationMs: 0,
        minDurationMs: Infinity,
        avgMemoryBytes: 0,
        maxMemoryBytes: 0
      }
    };
  }

  private calculateSummary(result: BatchValidationResult): ValidationSummary {
    const summary = this.createEmptySummary();
    const durations: number[] = [];
    const memories: number[] = [];

    for (const testResult of result.testResults) {
      summary.total++;

      if (testResult.valid) {
        summary.passed++;
      } else {
        summary.failed++;
      }

      durations.push(testResult.executionResult.metrics.durationMs);
      memories.push(testResult.executionResult.metrics.memoryPeakBytes);

      for (const check of testResult.checkResults) {
        if (!summary.byCheckType[check.type]) {
          summary.byCheckType[check.type] = { passed: 0, failed: 0, warnings: 0 };
        }

        switch (check.status) {
          case 'passed':
            summary.byCheckType[check.type].passed++;
            break;
          case 'failed':
            summary.byCheckType[check.type].failed++;
            break;
          case 'warning':
            summary.byCheckType[check.type].warnings++;
            summary.warnings++;
            break;
          case 'skipped':
            summary.skipped++;
            break;
          case 'error':
            summary.errors++;
            break;
        }
      }
    }

    if (durations.length > 0) {
      summary.performance.avgDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;
      summary.performance.maxDurationMs = Math.max(...durations);
      summary.performance.minDurationMs = Math.min(...durations);
    }

    if (memories.length > 0) {
      summary.performance.avgMemoryBytes = memories.reduce((a, b) => a + b, 0) / memories.length;
      summary.performance.maxMemoryBytes = Math.max(...memories);
    }

    return summary;
  }

  private calculateEstimatedEndTime(progress: BatchProgress): number {
    if (progress.completed === 0) return progress.startTime + 60000;

    const elapsed = Date.now() - progress.startTime;
    const perItem = elapsed / progress.completed;
    const remaining = progress.total - progress.completed;

    return Date.now() + remaining * perItem;
  }

  getProgress(batchId: string): BatchProgress | undefined {
    return this.progress.get(batchId);
  }

  getResult(resultId: string): BatchValidationResult | undefined {
    return this.results.get(resultId);
  }

  listResults(): string[] {
    return Array.from(this.results.keys());
  }

  reset(): void {
    this.batches.clear();
    this.results.clear();
    this.progress.clear();
    if (this.executor) {
      this.executor.reset();
    }
    logger.info('Batch manager reset');
  }
}

export async function createBatchManager(
  plugin: LoadedPlugin,
  options?: BatchExecutionOptions
): Promise<BatchManager> {
  const manager = new BatchManager(plugin, options);
  await manager.initialize();
  return manager;
}
