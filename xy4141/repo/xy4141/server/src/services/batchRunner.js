const { Batch, Sample, Run, Plugin, Review } = require('../models');
const sandboxExecutor = require('./sandboxExecutor');
const schemaValidator = require('./schemaValidator');
const { EventEmitter } = require('events');

class BatchRunner extends EventEmitter {
  constructor() {
    super();
    this.runningBatches = new Map();
  }

  async runBatch(batchId, options = {}) {
    if (this.runningBatches.has(batchId)) {
      return {
        success: false,
        error: 'Batch is already running'
      };
    }

    const batch = Batch.findById(batchId);
    if (!batch) {
      return {
        success: false,
        error: 'Batch not found'
      };
    }

    const plugin = Plugin.findById(batch.plugin_id);
    if (!plugin) {
      return {
        success: false,
        error: 'Plugin not found for this batch'
      };
    }

    const samples = Sample.findAll(batchId);
    if (samples.length === 0) {
      return {
        success: false,
        error: 'No samples found for this batch'
      };
    }

    Batch.update(batchId, { status: 'running' });
    this.runningBatches.set(batchId, {
      startedAt: Date.now(),
      currentIndex: 0,
      total: samples.length
    });

    this.emit('batch:start', {
      batchId,
      pluginId: batch.plugin_id,
      sampleCount: samples.length
    });

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < samples.length; i++) {
      if (!this.runningBatches.has(batchId)) {
        this.emit('batch:cancelled', { batchId, completedCount: i });
        Batch.update(batchId, { status: 'cancelled' });
        return {
          success: true,
          cancelled: true,
          completedCount: i
        };
      }

      const sample = samples[i];
      
      this.runningBatches.set(batchId, {
        ...this.runningBatches.get(batchId),
        currentIndex: i
      });

      this.emit('sample:start', {
        batchId,
        sampleId: sample.id,
        index: i,
        total: samples.length
      });

      const runResult = await this._runSample(sample, plugin, options);
      results.push(runResult);

      if (runResult.status === 'passed') {
        successCount++;
      } else {
        failureCount++;
      }

      this.emit('sample:complete', {
        batchId,
        sampleId: sample.id,
        index: i,
        total: samples.length,
        result: runResult
      });
    }

    this.runningBatches.delete(batchId);

    const finalStatus = failureCount === 0 ? 'completed' : 'completed_with_errors';
    Batch.update(batchId, { status: finalStatus });

    this.emit('batch:complete', {
      batchId,
      finalStatus,
      successCount,
      failureCount,
      total: samples.length
    });

    return {
      success: true,
      batchId,
      finalStatus,
      successCount,
      failureCount,
      total: samples.length,
      results
    };
  }

  async _runSample(sample, plugin, options = {}) {
    const inputData = JSON.parse(sample.input_data);
    const expectedOutput = sample.expected_output ? JSON.parse(sample.expected_output) : null;

    const run = Run.create({
      batch_id: sample.batch_id,
      sample_id: sample.id,
      plugin_id: plugin.id,
      input_data: inputData,
      status: 'running'
    });

    try {
      const pluginManifest = JSON.parse(plugin.manifest);
      const inputSchema = plugin.input_schema ? JSON.parse(plugin.input_schema) : null;
      const outputSchema = plugin.output_schema ? JSON.parse(plugin.output_schema) : null;

      if (inputSchema) {
        const inputValidation = schemaValidator.validateInput(inputData, inputSchema);
        if (!inputValidation.valid) {
          Run.update(run.id, {
            status: 'failed',
            schema_validation_passed: false,
            schema_errors: inputValidation.errors,
            error_message: 'Input schema validation failed'
          });
          return {
            runId: run.id,
            sampleId: sample.id,
            status: 'failed',
            error: 'Input schema validation failed',
            schemaErrors: inputValidation.errors
          };
        }
      }

      const executionOptions = {
        timeoutMs: options.timeoutMs || plugin.max_timeout_ms || 5000,
        maxMemoryMb: options.maxMemoryMb || plugin.max_memory_mb || 64,
        performanceThresholdMs: plugin.performance_threshold_ms || 1000,
        entrypoint: pluginManifest.entrypoint || 'process'
      };

      const executionResult = await sandboxExecutor.execute(
        plugin.wasm_path,
        inputData,
        executionOptions
      );

      let schemaValidationPassed = null;
      let schemaErrors = null;
      let finalStatus = executionResult.status;
      let errorMessage = executionResult.errorMessage;

      if (executionResult.status === 'passed' && outputSchema) {
        const outputValidation = schemaValidator.validateExpectedOutput(
          executionResult.outputData,
          expectedOutput,
          outputSchema
        );

        schemaValidationPassed = outputValidation.valid;
        schemaErrors = outputValidation.errors;

        if (!outputValidation.valid) {
          finalStatus = 'failed';
          if (!errorMessage) {
            errorMessage = 'Output validation failed';
          }
        }
      } else if (executionResult.status === 'passed' && expectedOutput) {
        const fieldComparison = schemaValidator._compareFields(
          executionResult.outputData,
          expectedOutput
        );

        if (!fieldComparison.matches) {
          finalStatus = 'failed';
          errorMessage = 'Output does not match expected result';
          schemaErrors = [{
            type: 'expected_mismatch',
            differences: fieldComparison.differences
          }];
        }
      }

      Run.update(run.id, {
        output_data: executionResult.outputData,
        execution_time_ms: executionResult.executionTimeMs,
        memory_usage_mb: executionResult.memoryUsageMb,
        status: finalStatus,
        error_message: errorMessage,
        error_code: executionResult.errorCode,
        schema_validation_passed: schemaValidationPassed,
        schema_errors: schemaErrors
      });

      return {
        runId: run.id,
        sampleId: sample.id,
        status: finalStatus,
        outputData: executionResult.outputData,
        executionTimeMs: executionResult.executionTimeMs,
        memoryUsageMb: executionResult.memoryUsageMb,
        errorMessage: errorMessage,
        errorCode: executionResult.errorCode,
        schemaValidationPassed,
        schemaErrors,
        performanceAlert: executionResult.performanceAlert
      };

    } catch (error) {
      Run.update(run.id, {
        status: 'error',
        error_message: error.message,
        error_code: 'UNEXPECTED_ERROR'
      });

      return {
        runId: run.id,
        sampleId: sample.id,
        status: 'error',
        error: error.message,
        errorCode: 'UNEXPECTED_ERROR'
      };
    }
  }

  cancelBatch(batchId) {
    if (this.runningBatches.has(batchId)) {
      this.runningBatches.delete(batchId);
      this.emit('batch:cancelled', { batchId });
      return true;
    }
    return false;
  }

  getBatchProgress(batchId) {
    const progress = this.runningBatches.get(batchId);
    if (!progress) {
      return null;
    }

    return {
      batchId,
      startedAt: progress.startedAt,
      currentIndex: progress.currentIndex,
      total: progress.total,
      progressPercent: Math.round((progress.currentIndex / progress.total) * 100)
    };
  }

  isBatchRunning(batchId) {
    return this.runningBatches.has(batchId);
  }

  getRunningBatches() {
    return Array.from(this.runningBatches.keys());
  }
}

module.exports = new BatchRunner();
