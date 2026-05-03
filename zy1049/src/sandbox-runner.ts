import * as vm from 'vm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginRunResult, PluginInfo, CapabilityCall, Permission, SandboxContext, EventRecord } from './types';
import { PluginEventBus } from './event-bus';

const CAPABILITY_MAP: Record<string, Permission> = {
  'fs.readFile': 'fs:read',
  'fs.readFileSync': 'fs:read',
  'fs.exists': 'fs:read',
  'fs.stat': 'fs:read',
  'fs.readDir': 'fs:read',
  'fs.writeFile': 'fs:write',
  'fs.writeFileSync': 'fs:write',
  'fs.appendFile': 'fs:write',
  'fs.delete': 'fs:delete',
  'fs.rm': 'fs:delete',
  'network.fetch': 'network:fetch',
  'network.http': 'network:http',
  'env.get': 'env:read',
  'env.set': 'env:write',
  'event.subscribe': 'event:subscribe',
  'event.publish': 'event:publish',
  'process.spawn': 'process:spawn',
  'process.exec': 'process:exec',
};

export class SandboxRunner {
  private pluginInfo: PluginInfo;
  private declaredPermissions: Permission[];
  private timeout: number;
  private runId: string;
  private capabilityCalls: CapabilityCall[];
  private consoleOutput: string[];
  private eventBus: PluginEventBus;
  private allowedPaths: string[];
  private allowedEnvs: string[];
  private allowedEvents: string[];
  private activeTimers: Set<number>;
  private activeIntervals: Set<number>;

  constructor(pluginInfo: PluginInfo, defaultTimeout: number = 30000) {
    this.pluginInfo = pluginInfo;
    this.declaredPermissions = pluginInfo.manifest.permissions || [];
    this.timeout = pluginInfo.manifest.timeout || defaultTimeout;
    this.runId = this.generateRunId();
    this.capabilityCalls = [];
    this.consoleOutput = [];
    this.eventBus = new PluginEventBus(pluginInfo.name);
    this.allowedPaths = [pluginInfo.path];
    this.allowedEnvs = [];
    this.allowedEvents = ['plugin:init', 'plugin:ready', 'plugin:done'];
    this.activeTimers = new Set();
    this.activeIntervals = new Set();
  }

  private generateRunId(): string {
    return `${Date.now()}-${this.pluginInfo.name}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getRunId(): string {
    return this.runId;
  }

  private recordCapabilityCall(
    capability: Permission,
    method: string,
    args: unknown[],
    success: boolean,
    error?: Error
  ): void {
    const call: CapabilityCall = {
      timestamp: Date.now(),
      capability,
      method,
      args: this.sanitizeArgs(args),
      success,
      error: error?.message,
      stack: error?.stack,
    };
    this.capabilityCalls.push(call);
  }

  private sanitizeArgs(args: unknown[]): unknown[] {
    return args.map(arg => {
      if (typeof arg === 'function') {
        return '[Function]';
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          JSON.stringify(arg);
          return arg;
        } catch {
          return '[Circular]';
        }
      }
      return arg;
    });
  }

  private hasPermission(permission: Permission): boolean {
    return this.declaredPermissions.includes(permission);
  }

  private createSandboxContext(): SandboxContext {
    return {
      pluginName: this.pluginInfo.name,
      runId: this.runId,
      startTime: Date.now(),
      timeout: this.timeout,
      declaredPermissions: this.declaredPermissions,
    };
  }

  private createSandboxAPI(): Record<string, unknown> {
    const self = this;

    const fsAPI = {
      readFile: async (filePath: string, options?: { encoding?: string }) => {
        const perm: Permission = 'fs:read';
        const hasPerm = self.hasPermission(perm);
        const resolvedPath = path.resolve(self.pluginInfo.path, filePath);
        
        const isAllowed = self.isPathAllowed(resolvedPath);
        
        self.recordCapabilityCall(perm, 'fs.readFile', [filePath, options], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Path not allowed: ${filePath}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }
        if (!isAllowed) {
          throw new Error(`Path not allowed: ${filePath}`);
        }

        return fs.readFile(resolvedPath, options?.encoding as BufferEncoding);
      },

      exists: async (filePath: string) => {
        const perm: Permission = 'fs:read';
        const hasPerm = self.hasPermission(perm);
        const resolvedPath = path.resolve(self.pluginInfo.path, filePath);
        const isAllowed = self.isPathAllowed(resolvedPath);

        self.recordCapabilityCall(perm, 'fs.exists', [filePath], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Path not allowed: ${filePath}`) : undefined);

        if (!hasPerm || !isAllowed) {
          return false;
        }

        try {
          await fs.access(resolvedPath);
          return true;
        } catch {
          return false;
        }
      },

      readDir: async (dirPath: string) => {
        const perm: Permission = 'fs:read';
        const hasPerm = self.hasPermission(perm);
        const resolvedPath = path.resolve(self.pluginInfo.path, dirPath);
        const isAllowed = self.isPathAllowed(resolvedPath);

        self.recordCapabilityCall(perm, 'fs.readDir', [dirPath], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Path not allowed: ${dirPath}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }
        if (!isAllowed) {
          throw new Error(`Path not allowed: ${dirPath}`);
        }

        return fs.readdir(resolvedPath);
      },

      writeFile: async (filePath: string, content: string, options?: object) => {
        const perm: Permission = 'fs:write';
        const hasPerm = self.hasPermission(perm);
        const resolvedPath = path.resolve(self.pluginInfo.path, filePath);
        const isAllowed = self.isPathAllowed(resolvedPath);

        self.recordCapabilityCall(perm, 'fs.writeFile', [filePath, content.length + ' chars', options], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Path not allowed: ${filePath}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }
        if (!isAllowed) {
          throw new Error(`Path not allowed: ${filePath}`);
        }

        await fs.writeFile(resolvedPath, content, options as object);
      },

      appendFile: async (filePath: string, content: string) => {
        const perm: Permission = 'fs:write';
        const hasPerm = self.hasPermission(perm);
        const resolvedPath = path.resolve(self.pluginInfo.path, filePath);
        const isAllowed = self.isPathAllowed(resolvedPath);

        self.recordCapabilityCall(perm, 'fs.appendFile', [filePath, content.length + ' chars'], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Path not allowed: ${filePath}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }
        if (!isAllowed) {
          throw new Error(`Path not allowed: ${filePath}`);
        }

        await fs.appendFile(resolvedPath, content);
      },

      delete: async (filePath: string) => {
        const perm: Permission = 'fs:delete';
        const hasPerm = self.hasPermission(perm);
        const resolvedPath = path.resolve(self.pluginInfo.path, filePath);
        const isAllowed = self.isPathAllowed(resolvedPath);

        self.recordCapabilityCall(perm, 'fs.delete', [filePath], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Path not allowed: ${filePath}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }
        if (!isAllowed) {
          throw new Error(`Path not allowed: ${filePath}`);
        }

        await fs.rm(resolvedPath, { recursive: true, force: true });
      },
    };

    const networkAPI = {
      fetch: async (url: string, options?: object) => {
        const perm: Permission = 'network:fetch';
        const hasPerm = self.hasPermission(perm);

        self.recordCapabilityCall(perm, 'network.fetch', [url, options], hasPerm,
          !hasPerm ? new Error(`Permission denied: ${perm}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }

        if (url.startsWith('http://') || url.startsWith('https://')) {
          throw new Error(`Network requests to external URLs are blocked in sandbox mode. URL: ${url}`);
        }

        return {
          status: 403,
          statusText: 'Forbidden - Sandbox Mode',
          ok: false,
          json: async () => ({ error: 'sandbox_mode', message: 'Network access simulated' }),
          text: async () => 'Sandbox: Network access simulated',
        };
      },

      http: (method: string, url: string, options?: object) => {
        const perm: Permission = 'network:http';
        const hasPerm = self.hasPermission(perm);

        self.recordCapabilityCall(perm, 'network.http', [method, url, options], hasPerm,
          !hasPerm ? new Error(`Permission denied: ${perm}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }

        return Promise.reject(new Error(`HTTP requests to external URLs are blocked in sandbox mode. URL: ${url}`));
      },
    };

    const envAPI = {
      get: (key: string) => {
        const perm: Permission = 'env:read';
        const hasPerm = self.hasPermission(perm);
        const isAllowed = self.allowedEnvs.length === 0 || self.allowedEnvs.includes(key);

        self.recordCapabilityCall(perm, 'env.get', [key], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Env variable not allowed: ${key}`) : undefined);

        if (!hasPerm || !isAllowed) {
          return undefined;
        }

        return undefined;
      },

      set: (key: string, value: string) => {
        const perm: Permission = 'env:write';
        const hasPerm = self.hasPermission(perm);

        self.recordCapabilityCall(perm, 'env.set', [key], hasPerm,
          !hasPerm ? new Error(`Permission denied: ${perm}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }
      },
    };

    const eventAPI = {
      subscribe: (eventName: string, listener: (...args: unknown[]) => void) => {
        const perm: Permission = 'event:subscribe';
        const hasPerm = self.hasPermission(perm);

        self.recordCapabilityCall(perm, 'event.subscribe', [eventName], hasPerm,
          !hasPerm ? new Error(`Permission denied: ${perm}`) : undefined);

        if (!hasPerm) {
          return;
        }

        self.eventBus.subscribe(eventName, listener);
      },

      publish: (eventName: string, data?: unknown) => {
        const perm: Permission = 'event:publish';
        const hasPerm = self.hasPermission(perm);
        const isAllowed = self.allowedEvents.length === 0 || self.allowedEvents.includes(eventName);

        self.recordCapabilityCall(perm, 'event.publish', [eventName, data], hasPerm && isAllowed,
          !hasPerm ? new Error(`Permission denied: ${perm}`) :
          !isAllowed ? new Error(`Event not allowed: ${eventName}`) : undefined);

        if (!hasPerm) {
          return;
        }

        self.eventBus.publish(eventName, data);
      },

      emit: (eventName: string, data?: unknown) => {
        const perm: Permission = 'event:publish';
        const hasPerm = self.hasPermission(perm);

        self.recordCapabilityCall(perm, 'event.emit', [eventName, data], hasPerm,
          !hasPerm ? new Error(`Permission denied: ${perm}`) : undefined);

        if (!hasPerm) {
          return;
        }

        self.eventBus.emit(eventName, data);
      },
    };

    const processAPI = {
      spawn: (command: string, args?: string[]) => {
        const perm: Permission = 'process:spawn';
        const hasPerm = self.hasPermission(perm);

        self.recordCapabilityCall(perm, 'process.spawn', [command, args], hasPerm,
          !hasPerm ? new Error(`Permission denied: ${perm}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }

        throw new Error(`Process spawning is blocked in sandbox mode. Command: ${command}`);
      },

      exec: (command: string) => {
        const perm: Permission = 'process:exec';
        const hasPerm = self.hasPermission(perm);

        self.recordCapabilityCall(perm, 'process.exec', [command], hasPerm,
          !hasPerm ? new Error(`Permission denied: ${perm}`) : undefined);

        if (!hasPerm) {
          throw new Error(`Permission denied: ${perm}`);
        }

        throw new Error(`Process execution is blocked in sandbox mode. Command: ${command}`);
      },
    };

    const sandboxConsole = {
      log: (...args: unknown[]) => {
        const message = args.map(a => String(a)).join(' ');
        self.consoleOutput.push(`[log] ${message}`);
      },
      error: (...args: unknown[]) => {
        const message = args.map(a => String(a)).join(' ');
        self.consoleOutput.push(`[error] ${message}`);
      },
      warn: (...args: unknown[]) => {
        const message = args.map(a => String(a)).join(' ');
        self.consoleOutput.push(`[warn] ${message}`);
      },
      info: (...args: unknown[]) => {
        const message = args.map(a => String(a)).join(' ');
        self.consoleOutput.push(`[info] ${message}`);
      },
      debug: (...args: unknown[]) => {
        const message = args.map(a => String(a)).join(' ');
        self.consoleOutput.push(`[debug] ${message}`);
      },
    };

    const wrappedSetTimeout = (callback: (...args: unknown[]) => void, delay: number, ...args: unknown[]): number => {
      const wrappedCallback = () => {
        try {
          callback(...args);
        } catch (err) {
          self.consoleOutput.push(`[error] Uncaught in setTimeout: ${(err as Error).message}`);
        }
      };
      const timerId = setTimeout(wrappedCallback, delay);
      self.activeTimers.add(timerId);
      return timerId;
    };

    const wrappedClearTimeout = (timerId: number): void => {
      clearTimeout(timerId);
      self.activeTimers.delete(timerId);
    };

    const wrappedSetInterval = (callback: (...args: unknown[]) => void, delay: number, ...args: unknown[]): number => {
      const wrappedCallback = () => {
        try {
          callback(...args);
        } catch (err) {
          self.consoleOutput.push(`[error] Uncaught in setInterval: ${(err as Error).message}`);
        }
      };
      const intervalId = setInterval(wrappedCallback, delay);
      self.activeIntervals.add(intervalId);
      return intervalId;
    };

    const wrappedClearInterval = (intervalId: number): void => {
      clearInterval(intervalId);
      self.activeIntervals.delete(intervalId);
    };

    return {
      console: sandboxConsole,
      __context: this.createSandboxContext(),
      fs: fsAPI,
      network: networkAPI,
      env: envAPI,
      event: eventAPI,
      process: processAPI,
      setTimeout: wrappedSetTimeout,
      clearTimeout: wrappedClearTimeout,
      setInterval: wrappedSetInterval,
      clearInterval: wrappedClearInterval,
      Promise: Promise,
      Buffer: Buffer,
      Date: Date,
      Math: Math,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Symbol: Symbol,
      Map: Map,
      Set: Set,
      WeakMap: WeakMap,
      WeakSet: WeakSet,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      decodeURI: decodeURI,
      decodeURIComponent: decodeURIComponent,
      encodeURI: encodeURI,
      encodeURIComponent: encodeURIComponent,
      RegExp: RegExp,
      Error: Error,
      TypeError: TypeError,
      SyntaxError: SyntaxError,
      ReferenceError: ReferenceError,
      RangeError: RangeError,
      URIError: URIError,
      EvalError: EvalError,
    };
  }

  private isPathAllowed(resolvedPath: string): boolean {
    for (const allowedPath of this.allowedPaths) {
      const resolvedAllowed = path.resolve(allowedPath);
      if (resolvedPath.startsWith(resolvedAllowed + path.sep) || resolvedPath === resolvedAllowed) {
        return true;
      }
    }
    return false;
  }

  private clearAllTimers(): void {
    for (const timerId of this.activeTimers) {
      clearTimeout(timerId);
    }
    this.activeTimers.clear();

    for (const intervalId of this.activeIntervals) {
      clearInterval(intervalId);
    }
    this.activeIntervals.clear();
  }

  async run(): Promise<PluginRunResult> {
    const startTime = Date.now();
    let isTimeout = false;
    let isCrashed = false;
    let errorMessage: string | undefined;
    let errorStack: string | undefined;
    let exitCode = 0;

    let timer: NodeJS.Timeout | null = null;
    let executionCompleted = false;
    let executionError: Error | null = null;

    const originalListeners = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');

    const sandboxUnhandledRejection = (reason: unknown, promise: Promise<unknown>) => {
      const msg = reason instanceof Error ? reason.message : String(reason);
      this.consoleOutput.push(`[error] Unhandled Rejection in plugin: ${msg}`);
      executionError = reason instanceof Error ? reason : new Error(msg);
    };

    process.on('unhandledRejection', sandboxUnhandledRejection);

    try {
      const pluginCode = await fs.readFile(this.pluginInfo.mainPath, 'utf-8');
      const sandbox = this.createSandboxAPI();
      
      const context = vm.createContext(sandbox);
      
      const wrappedCode = `
        (function() {
          ${pluginCode}
        })();
      `;
      
      const script = new vm.Script(wrappedCode, {
        filename: this.pluginInfo.mainPath,
        displayErrors: true,
      });

      const runPromise = new Promise<Error | null>((resolve) => {
        timer = setTimeout(() => {
          isTimeout = true;
          resolve(new Error(`Plugin execution timed out after ${this.timeout}ms`));
        }, this.timeout);

        try {
          script.runInContext(context, {
            timeout: this.timeout,
            displayErrors: true,
          });
          
          setTimeout(() => {
            if (!isTimeout) {
              resolve(executionError);
            }
          }, 100);
          
        } catch (error) {
          resolve(error as Error);
        }
      });

      const resultError = await runPromise;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      this.clearAllTimers();

      if (resultError) {
        if (!isTimeout) {
          isCrashed = true;
        }
        exitCode = 1;
        errorMessage = resultError.message;
        errorStack = resultError.stack;
      }

      executionCompleted = true;

    } catch (error) {
      isCrashed = true;
      exitCode = 1;
      errorMessage = (error as Error).message;
      errorStack = (error as Error).stack;
    } finally {
      this.clearAllTimers();
      
      process.removeListener('unhandledRejection', sandboxUnhandledRejection);
      
      for (const listener of originalListeners) {
        process.on('unhandledRejection', listener as (...args: unknown[]) => void);
      }
    }

    const endTime = Date.now();
    const events = this.eventBus.getEvents();

    const result: PluginRunResult = {
      pluginName: this.pluginInfo.name,
      runId: this.runId,
      success: !isCrashed && !isTimeout,
      exitCode,
      startTime,
      endTime,
      duration: endTime - startTime,
      timeout: isTimeout,
      crashed: isCrashed,
      errorMessage,
      errorStack,
      capabilityCalls: this.capabilityCalls,
      events,
      consoleOutput: this.consoleOutput,
    };

    this.eventBus.destroy();

    return result;
  }

  getCapabilityCalls(): CapabilityCall[] {
    return [...this.capabilityCalls];
  }

  getEvents(): EventRecord[] {
    return this.eventBus.getEvents();
  }

  getConsoleOutput(): string[] {
    return [...this.consoleOutput];
  }

  addAllowedPath(path: string): void {
    this.allowedPaths.push(path);
  }

  addAllowedEnv(env: string): void {
    this.allowedEnvs.push(env);
  }

  addAllowedEvent(event: string): void {
    this.allowedEvents.push(event);
  }
}

export default SandboxRunner;
