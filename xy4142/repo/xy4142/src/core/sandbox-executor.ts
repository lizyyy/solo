import { v4 as uuidv4 } from 'uuid';
import {
  ExecutionResult,
  ExecutionStatus,
  ExecutionOutput,
  ExecutionMetrics,
  ExecutionError,
  TestCaseInput,
  Constraints,
  Capability
} from '../types';
import { LoadedPlugin } from './plugin-loader';
import { createLogger } from '../utils/logger';
import {
  SandboxExecutionError,
  TimeoutError,
  MemoryExceededError,
  errorToRecord
} from '../utils/error';

const logger = createLogger('sandbox-executor');

export interface SandboxOptions {
  timeoutMs?: number;
  memoryPagesMax?: number;
  memoryBytesMax?: number;
  allowedCapabilities?: Capability[];
  enableProfiling?: boolean;
  maxExecutions?: number;
}

export interface ExecutionEnvironment {
  imports: WebAssembly.ModuleImports;
  memory: WebAssembly.Memory | null;
  memorySizeBytes: number;
  peakMemoryBytes: number;
  startTime: bigint;
  timeoutId: NodeJS.Timeout | null;
  isAborted: boolean;
}

const DEFAULT_SANDBOX_OPTIONS: Required<SandboxOptions> = {
  timeoutMs: 5000,
  memoryPagesMax: 16,
  memoryBytesMax: 16 * 64 * 1024,
  allowedCapabilities: [],
  enableProfiling: false,
  maxExecutions: 1000
};

export class SandboxExecutor {
  private options: Required<SandboxOptions>;
  private wasmModule: WebAssembly.Module | null = null;
  private environment: ExecutionEnvironment | null = null;
  private executionCount: number = 0;

  constructor(plugin: LoadedPlugin, options?: SandboxOptions) {
    this.options = {
      ...DEFAULT_SANDBOX_OPTIONS,
      timeoutMs: plugin.manifest.constraints.timeoutMs,
      memoryPagesMax: plugin.manifest.constraints.memoryPagesMax,
      memoryBytesMax: plugin.manifest.constraints.memoryBytesMax || 
        plugin.manifest.constraints.memoryPagesMax * 64 * 1024,
      ...options
    };
  }

  async initialize(wasmBuffer: Buffer): Promise<void> {
    logger.info('Initializing WebAssembly sandbox...');

    try {
      this.wasmModule = await WebAssembly.compile(wasmBuffer);
      logger.info('WebAssembly module compiled successfully');
    } catch (error) {
      throw new SandboxExecutionError('Failed to compile WebAssembly module', {
        error: errorToRecord(error)
      });
    }
  }

  async execute(input: TestCaseInput): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startedAt = Date.now();
    const metrics: ExecutionMetrics = {
      durationMs: 0,
      cpuTimeMs: 0,
      memoryUsedBytes: 0,
      memoryPeakBytes: 0,
      instructionsExecuted: 0
    };

    logger.debug(`Executing test case in sandbox... (ID: ${executionId})`);

    if (this.executionCount >= this.options.maxExecutions) {
      throw new SandboxExecutionError('Maximum execution count exceeded', {
        count: this.executionCount,
        max: this.options.maxExecutions
      });
    }

    if (!this.wasmModule) {
      throw new SandboxExecutionError('Sandbox not initialized. Call initialize() first.');
    }

    this.executionCount++;

    const result: ExecutionResult = {
      testCaseId: executionId,
      status: 'pending',
      output: {
        raw: '',
        parsed: null,
        format: input.format,
        sizeBytes: 0
      },
      metrics,
      errors: [],
      warnings: [],
      startedAt,
      completedAt: startedAt
    };

    const startTime = process.hrtime.bigint();
    let timeoutId: NodeJS.Timeout | null = null;
    let isAborted = false;

    try {
      result.status = 'running';

      const initialMemoryPages = this.options.memoryPagesMax;
      const memory = new WebAssembly.Memory({
        initial: Math.min(1, initialMemoryPages),
        maximum: initialMemoryPages
      });

      let memoryGrowthAttempts = 0;
      const maxMemoryGrowth = initialMemoryPages - 1;

      const imports = this.createImportObject(memory, {
        onMemoryGrow: (delta: number) => {
          memoryGrowthAttempts += delta;
          if (memoryGrowthAttempts > maxMemoryGrowth) {
            isAborted = true;
            throw new MemoryExceededError(
              memory.buffer.byteLength + delta * 64 * 1024,
              this.options.memoryBytesMax
            );
          }
          metrics.memoryPeakBytes = Math.max(
            metrics.memoryPeakBytes,
            memory.buffer.byteLength
          );
        }
      });

      timeoutId = setTimeout(() => {
        isAborted = true;
        logger.warn(`Execution timeout after ${this.options.timeoutMs}ms`);
      }, this.options.timeoutMs);

      const instance = await WebAssembly.instantiate(this.wasmModule, imports);

      metrics.memoryUsedBytes = memory.buffer.byteLength;
      metrics.memoryPeakBytes = metrics.memoryUsedBytes;

      const inputPtr = this.writeInputToMemory(input, memory, instance);

      const entrypointName = this.detectEntrypoint(instance);
      if (!entrypointName) {
        throw new SandboxExecutionError('No entrypoint function found in WASM module');
      }

      const entrypoint = (instance.exports as Record<string, CallableFunction>)[entrypointName];
      if (typeof entrypoint !== 'function') {
        throw new SandboxExecutionError(`Entrypoint "${entrypointName}" is not a function`);
      }

      const outputPtr = entrypoint(inputPtr);

      const output = this.readOutputFromMemory(outputPtr, memory, instance, input.format);
      result.output = output;

      const endTime = process.hrtime.bigint();
      const durationNs = endTime - startTime;
      metrics.durationMs = Number(durationNs) / 1_000_000;
      metrics.cpuTimeMs = metrics.durationMs;
      metrics.memoryUsedBytes = memory.buffer.byteLength;

      if (isAborted) {
        throw new TimeoutError(this.options.timeoutMs);
      }

      result.status = 'completed';
      logger.debug(`Execution completed successfully in ${metrics.durationMs.toFixed(2)}ms`);

    } catch (error) {
      result.status = this.determineErrorStatus(error);
      result.errors.push({
        code: error instanceof SandboxExecutionError ? error.code : 'EXECUTION_ERROR',
        message: (error as Error).message,
        details: errorToRecord(error).details,
        stack: (error as Error).stack
      });
      logger.error(`Execution failed: ${(error as Error).message}`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const endTime = process.hrtime.bigint();
      const durationNs = endTime - startTime;
      if (metrics.durationMs === 0) {
        metrics.durationMs = Number(durationNs) / 1_000_000;
      }

      result.metrics = metrics;
      result.completedAt = Date.now();

      this.cleanup();
    }

    return result;
  }

  private createImportObject(
    memory: WebAssembly.Memory,
    hooks: { onMemoryGrow: (delta: number) => void }
  ): WebAssembly.ModuleImports {
    const allowedCaps = this.options.allowedCapabilities;

    return {
      env: {
        memory,

        'console.log': this.createSecuredFunction((ptr: number, len: number) => {
          logger.debug(`[WASM log] ${this.readStringFromMemory(ptr, len, memory)}`);
        }, 'log'),

        'console.error': this.createSecuredFunction((ptr: number, len: number) => {
          logger.error(`[WASM error] ${this.readStringFromMemory(ptr, len, memory)}`);
        }, 'log'),

        abort: this.createSecuredFunction(() => {
          throw new SandboxExecutionError('WASM module aborted execution');
        }, 'control'),

        memory_grow: this.createSecuredFunction((delta: number) => {
          hooks.onMemoryGrow(delta);
          try {
            return memory.grow(delta);
          } catch (error) {
            throw new MemoryExceededError(
              memory.buffer.byteLength + delta * 64 * 1024,
              this.options.memoryBytesMax
            );
          }
        }, 'memory'),

        emscripten_resize_heap: this.createSecuredFunction((size: number) => {
          const currentPages = memory.buffer.byteLength / (64 * 1024);
          const newPages = Math.ceil(size / (64 * 1024));
          const delta = newPages - currentPages;

          if (delta > 0) {
            hooks.onMemoryGrow(delta);
            memory.grow(delta);
          }
          return 1;
        }, 'memory'),
      },

      wasi_snapshot_preview1: {
        environ_sizes_get: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('environment')) {
            throw new SandboxExecutionError('Environment access is not allowed');
          }
          return 0;
        }, 'environment'),

        environ_get: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('environment')) {
            throw new SandboxExecutionError('Environment access is not allowed');
          }
          return 0;
        }, 'environment'),

        clock_time_get: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('clock')) {
            throw new SandboxExecutionError('Clock access is not allowed');
          }
          return 0;
        }, 'clock'),

        random_get: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('random')) {
            throw new SandboxExecutionError('Random number access is not allowed');
          }
          return 0;
        }, 'random'),

        fd_read: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('file_read')) {
            throw new SandboxExecutionError('File read access is not allowed');
          }
          return 0;
        }, 'file'),

        fd_write: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('file_write')) {
            throw new SandboxExecutionError('File write access is not allowed');
          }
          return 0;
        }, 'file'),

        sock_accept: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('network')) {
            throw new SandboxExecutionError('Network access is not allowed');
          }
          return 0;
        }, 'network'),

        sock_recv: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('network')) {
            throw new SandboxExecutionError('Network access is not allowed');
          }
          return 0;
        }, 'network'),

        sock_send: this.createSecuredFunction(() => {
          if (!allowedCaps.includes('network')) {
            throw new SandboxExecutionError('Network access is not allowed');
          }
          return 0;
        }, 'network'),
      }
    };
  }

  private createSecuredFunction(
    fn: (...args: unknown[]) => unknown,
    capability: string
  ): (...args: unknown[]) => unknown {
    return (...args: unknown[]) => {
      try {
        return fn(...args);
      } catch (error) {
        if (error instanceof SandboxExecutionError) {
          throw error;
        }
        throw new SandboxExecutionError(
          `Error in ${capability} operation: ${(error as Error).message}`,
          { capability, args: this.sanitizeArgs(args) }
        );
      }
    };
  }

  private sanitizeArgs(args: unknown[]): unknown[] {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return '[object]';
      }
      return arg;
    });
  }

  private detectEntrypoint(instance: WebAssembly.Instance): string | null {
    const exports = Object.keys(instance.exports);

    const priorityOrder = [
      'inspect',
      'execute',
      'process',
      'run',
      'main',
      'start'
    ];

    for (const name of priorityOrder) {
      if (exports.includes(name) && 
          typeof (instance.exports as Record<string, unknown>)[name] === 'function') {
        return name;
      }
    }

    const functionExports = exports.filter(
      name => typeof (instance.exports as Record<string, unknown>)[name] === 'function'
    );

    return functionExports.find(name => !name.startsWith('_')) || functionExports[0] || null;
  }

  private writeInputToMemory(
    input: TestCaseInput,
    memory: WebAssembly.Memory,
    instance: WebAssembly.Instance
  ): number {
    const dataStr = typeof input.data === 'string' 
      ? input.data 
      : JSON.stringify(input.data);
    const encoder = new TextEncoder();
    const data = encoder.encode(dataStr);

    const alloc = (instance.exports as Record<string, CallableFunction>)['malloc'];
    const ptr = alloc ? alloc(data.length + 1) : this.fallbackAlloc(data.length + 1, memory);

    const view = new Uint8Array(memory.buffer);
    view.set(data, ptr);
    view[ptr + data.length] = 0;

    return ptr;
  }

  private readOutputFromMemory(
    ptr: number,
    memory: WebAssembly.Memory,
    instance: WebAssembly.Instance,
    format: 'json' | 'binary' | 'protobuf'
  ): ExecutionOutput {
    const view = new Uint8Array(memory.buffer);
    let length = 0;
    let currentPtr = ptr;

    while (view[currentPtr] !== 0 && currentPtr < view.length) {
      length++;
      currentPtr++;
    }

    const data = view.slice(ptr, ptr + length);

    let parsed: unknown;
    if (format === 'json') {
      try {
        const decoder = new TextDecoder();
        parsed = JSON.parse(decoder.decode(data));
      } catch {
        parsed = null;
      }
    } else {
      parsed = data;
    }

    return {
      raw: format === 'binary' ? data : new TextDecoder().decode(data),
      parsed,
      format,
      sizeBytes: length
    };
  }

  private readStringFromMemory(
    ptr: number,
    len: number,
    memory: WebAssembly.Memory
  ): string {
    const view = new Uint8Array(memory.buffer, ptr, len);
    const decoder = new TextDecoder();
    return decoder.decode(view);
  }

  private fallbackAlloc(size: number, memory: WebAssembly.Memory): number {
    return memory.buffer.byteLength;
  }

  private determineErrorStatus(error: unknown): ExecutionStatus {
    if (error instanceof TimeoutError) {
      return 'timeout';
    }
    if (error instanceof MemoryExceededError) {
      return 'memory_exceeded';
    }
    if (error instanceof SandboxExecutionError) {
      return 'error';
    }
    return 'failed';
  }

  private cleanup(): void {
    this.environment = null;
  }

  reset(): void {
    this.environment = null;
    this.executionCount = 0;
    logger.info('Sandbox executor reset');
  }

  getOptions(): Readonly<SandboxOptions> {
    return { ...this.options };
  }

  getExecutionCount(): number {
    return this.executionCount;
  }
}

export async function createSandboxExecutor(
  plugin: LoadedPlugin,
  options?: SandboxOptions
): Promise<SandboxExecutor> {
  const executor = new SandboxExecutor(plugin, options);
  await executor.initialize(plugin.wasmBuffer);
  return executor;
}
