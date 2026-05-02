const fs = require('fs');
const { WebAssembly } = require('wasi-js');
const { v4: uuidv4 } = require('uuid');

class SandboxExecutor {
  constructor() {
    this.activeExecutions = new Map();
  }

  async execute(wasmPath, inputData, options = {}) {
    const {
      timeoutMs = 5000,
      maxMemoryMb = 64,
      performanceThresholdMs = 1000,
      entrypoint = 'process'
    } = options;

    const executionId = uuidv4();
    const start = Date.now();

    let instance;
    let memory;
    let wasmBuffer;

    try {
      wasmBuffer = fs.readFileSync(wasmPath);
      
      const memoryLimit = maxMemoryMb * 1024 * 1024;
      const wasmModule = new WebAssembly.Module(wasmBuffer);
      
      const moduleInfo = this._analyzeModule(wasmModule);
      const initialMemory = moduleInfo.memory?.initial || 1;
      const maxMemoryPages = moduleInfo.memory?.maximum || Math.ceil(memoryLimit / (64 * 1024));
      
      memory = new WebAssembly.Memory({
        initial: Math.min(initialMemory, maxMemoryPages),
        maximum: maxMemoryPages
      });

      const importObject = {
        env: {
          memory: memory,
          abort: this._createAbortHandler(executionId),
          emscripten_resize_heap: this._createMemoryResizeHandler(executionId, memoryLimit),
          __syscall_fstat: this._createSyscallHandler('fstat', executionId),
          __syscall_lseek: this._createSyscallHandler('lseek', executionId),
          __syscall_read: this._createSyscallHandler('read', executionId),
          __syscall_write: this._createSyscallHandler('write', executionId),
          __syscall_close: this._createSyscallHandler('close', executionId),
          __syscall_open: this._createSyscallHandler('open', executionId),
          __syscall_brk: this._createSyscallHandler('brk', executionId),
          __syscall_ioctl: this._createSyscallHandler('ioctl', executionId),
          __syscall_mprotect: this._createSyscallHandler('mprotect', executionId),
          __syscall_munmap: this._createSyscallHandler('munmap', executionId),
          __syscall_mmap: this._createMemoryMapHandler(executionId, memoryLimit),
          __syscall_getcwd: this._createSyscallHandler('getcwd', executionId),
          __syscall_unlink: this._createForbiddenHandler('unlink - file deletion not allowed', executionId),
          __syscall_mkdir: this._createForbiddenHandler('mkdir - directory creation not allowed', executionId),
          __syscall_rmdir: this._createForbiddenHandler('rmdir - directory deletion not allowed', executionId),
          __syscall_rename: this._createForbiddenHandler('rename - file rename not allowed', executionId),
          __syscall_stat: this._createForbiddenHandler('stat - file system access restricted', executionId),
          __syscall_access: this._createForbiddenHandler('access - file system access restricted', executionId),
        },
        wasi_snapshot_preview1: {
          fd_write: this._createForbiddenHandler('fd_write - write not allowed in sandbox', executionId),
          fd_read: this._createForbiddenHandler('fd_read - read not allowed in sandbox', executionId),
          fd_close: this._createForbiddenHandler('fd_close - file operations not allowed', executionId),
          fd_seek: this._createForbiddenHandler('fd_seek - file operations not allowed', executionId),
          fd_fdstat_get: this._createForbiddenHandler('fd_fdstat_get - file operations not allowed', executionId),
          path_open: this._createForbiddenHandler('path_open - file system access restricted', executionId),
          path_readlink: this._createForbiddenHandler('path_readlink - file system access restricted', executionId),
          path_unlink_file: this._createForbiddenHandler('path_unlink_file - file deletion not allowed', executionId),
          path_remove_directory: this._createForbiddenHandler('path_remove_directory - directory deletion not allowed', executionId),
          path_rename: this._createForbiddenHandler('path_rename - file rename not allowed', executionId),
          random_get: this._createRandomHandler(executionId),
          clock_time_get: this._createTimeHandler(executionId),
          proc_exit: this._createExitHandler(executionId),
        }
      };

      instance = await WebAssembly.instantiate(wasmModule, importObject);

      this.activeExecutions.set(executionId, {
        instance,
        memory,
        startTime: Date.now(),
        timeoutMs,
        isActive: true
      });

      const result = await this._executeWithTimeout(
        () => this._runEntrypoint(instance, entrypoint, inputData, memory),
        timeoutMs,
        executionId
      );

      const executionTimeMs = Date.now() - start;
      const memoryUsageMb = this._estimateMemoryUsage(memory);

      const performanceAlert = executionTimeMs > performanceThresholdMs
        ? `Performance threshold exceeded: ${executionTimeMs}ms > ${performanceThresholdMs}ms`
        : null;

      let outputData = null;
      let status = 'error';
      let errorMessage = null;
      let errorCode = null;

      if (result.success) {
        outputData = result.output;
        status = 'passed';
      } else {
        errorMessage = result.error;
        errorCode = result.errorCode;
        if (result.errorType === 'timeout') {
          status = 'timeout';
        } else if (result.errorType === 'memory') {
          status = 'error';
        } else {
          status = 'error';
        }
      }

      this.activeExecutions.delete(executionId);

      return {
        executionId,
        status,
        outputData,
        executionTimeMs,
        memoryUsageMb,
        errorMessage,
        errorCode,
        performanceAlert,
        performanceThresholdMs,
        timeoutMs,
        maxMemoryMb
      };

    } catch (error) {
      this.activeExecutions.delete(executionId);
      const executionTimeMs = Date.now() - start;

      return {
        executionId,
        status: 'error',
        outputData: null,
        executionTimeMs,
        memoryUsageMb: memory ? this._estimateMemoryUsage(memory) : 0,
        errorMessage: error.message,
        errorCode: 'INITIALIZATION_ERROR',
        timeoutMs,
        maxMemoryMb
      };
    }
  }

  _analyzeModule(module) {
    const exports = WebAssembly.Module.exports(module);
    const imports = WebAssembly.Module.imports(module);
    
    const memoryExport = exports.find(e => e.kind === 'memory');
    const memoryImport = imports.find(i => i.kind === 'memory');

    return {
      exports: exports.map(e => e.name),
      imports: imports.map(i => `${i.module}.${i.name}`),
      memory: memoryExport || memoryImport
    };
  }

  async _executeWithTimeout(fn, timeoutMs, executionId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
          execution.isActive = false;
        }
        resolve({
          success: false,
          error: `Execution timed out after ${timeoutMs}ms`,
          errorCode: 'TIMEOUT',
          errorType: 'timeout'
        });
      }, timeoutMs);

      try {
        const result = fn();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: error.message,
          errorCode: error.code || 'EXECUTION_ERROR',
          errorType: 'execution'
        });
      }
    });
  }

  _runEntrypoint(instance, entrypoint, inputData, memory) {
    const exports = instance.exports;
    
    const entrypointFunction = exports[entrypoint] || exports.run || exports.main || exports.process;
    
    if (!entrypointFunction) {
      return {
        success: false,
        error: `Entrypoint function '${entrypoint}' not found. Available exports: ${Object.keys(exports).join(', ')}`,
        errorCode: 'ENTRYPOINT_NOT_FOUND'
      };
    }

    const inputStr = typeof inputData === 'string' ? inputData : JSON.stringify(inputData);
    const inputLen = inputStr.length + 1;

    const memoryBuffer = new Uint8Array(memory.buffer);
    const allocFunction = exports.malloc || exports.__malloc || exports.alloc;
    
    let inputPtr;
    let outputPtr;

    try {
      if (allocFunction) {
        inputPtr = allocFunction(inputLen);
        outputPtr = allocFunction(1024 * 1024);
      } else {
        inputPtr = 1024;
        outputPtr = 1024 + inputLen;
      }

      for (let i = 0; i < inputStr.length; i++) {
        memoryBuffer[inputPtr + i] = inputStr.charCodeAt(i);
      }
      memoryBuffer[inputPtr + inputStr.length] = 0;

      let result;
      
      if (exports._start) {
        exports._start();
      }

      if (entrypointFunction.length === 2) {
        result = entrypointFunction(inputPtr, outputPtr);
      } else if (entrypointFunction.length === 1) {
        result = entrypointFunction(inputPtr);
      } else {
        result = entrypointFunction();
      }

      let outputStr = '';
      if (outputPtr !== undefined) {
        let ptr = outputPtr;
        while (memoryBuffer[ptr] !== 0 && ptr < memoryBuffer.length) {
          outputStr += String.fromCharCode(memoryBuffer[ptr]);
          ptr++;
        }
      }

      let outputData;
      if (outputStr) {
        try {
          outputData = JSON.parse(outputStr);
        } catch {
          outputData = outputStr;
        }
      } else if (result !== undefined && result !== null) {
        if (typeof result === 'number') {
          if (result === 0) {
            outputData = { success: true };
          } else {
            return {
              success: false,
              error: `Plugin returned non-zero exit code: ${result}`,
              errorCode: `EXIT_CODE_${result}`
            };
          }
        } else {
          outputData = result;
        }
      } else {
        outputData = { success: true };
      }

      return {
        success: true,
        output: outputData
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'RUNTIME_ERROR'
      };
    }
  }

  _estimateMemoryUsage(memory) {
    if (!memory || !memory.buffer) {
      return 0;
    }
    return Math.round(memory.buffer.byteLength / (1024 * 1024));
  }

  _createAbortHandler(executionId) {
    return (msg, file, line, col) => {
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.isActive = false;
      }
      throw new Error(`WASM aborted: ${msg || 'unknown error'} at ${file || 'unknown'}:${line}:${col}`);
    };
  }

  _createMemoryResizeHandler(executionId, limit) {
    return (requestedSize) => {
      const execution = this.activeExecutions.get(executionId);
      if (execution && !execution.isActive) {
        return -1;
      }
      if (requestedSize > limit) {
        throw new Error(`Memory limit exceeded: requested ${requestedSize} bytes, limit ${limit} bytes`);
      }
      return requestedSize;
    };
  }

  _createMemoryMapHandler(executionId, limit) {
    return (addr, len, prot, flags, fd, offset) => {
      const execution = this.activeExecutions.get(executionId);
      if (execution && !execution.isActive) {
        return -1;
      }
      if (len > limit) {
        throw new Error(`Memory map request exceeds limit: ${len} bytes`);
      }
      return 0;
    };
  }

  _createForbiddenHandler(message, executionId) {
    return () => {
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.isActive = false;
      }
      throw new Error(`Security violation: ${message}`);
    };
  }

  _createSyscallHandler(name, executionId) {
    return (...args) => {
      const execution = this.activeExecutions.get(executionId);
      if (execution && !execution.isActive) {
        return -1;
      }
      return 0;
    };
  }

  _createRandomHandler(executionId) {
    return (buf, bufLen) => {
      const execution = this.activeExecutions.get(executionId);
      if (execution && !execution.isActive) {
        return -1;
      }
      if (buf && execution?.memory?.buffer) {
        const memoryBuffer = new Uint8Array(execution.memory.buffer);
        for (let i = 0; i < bufLen && buf + i < memoryBuffer.length; i++) {
          memoryBuffer[buf + i] = Math.floor(Math.random() * 256);
        }
      }
      return 0;
    };
  }

  _createTimeHandler(executionId) {
    return (clockId, precision, result) => {
      const execution = this.activeExecutions.get(executionId);
      if (execution && !execution.isActive) {
        return -1;
      }
      return 0;
    };
  }

  _createExitHandler(executionId) {
    return (exitCode) => {
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.isActive = false;
      }
      throw new Error(`Plugin exited with code: ${exitCode}`);
    };
  }

  cancelExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.isActive = false;
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  getActiveExecutions() {
    return Array.from(this.activeExecutions.keys());
  }
}

module.exports = new SandboxExecutor();
