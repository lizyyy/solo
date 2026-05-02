export class BaseError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: number;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, BaseError.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export class PluginLoadError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PLUGIN_LOAD_ERROR', details);
    Object.setPrototypeOf(this, PluginLoadError.prototype);
  }
}

export class ManifestValidationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MANIFEST_VALIDATION_ERROR', details);
    Object.setPrototypeOf(this, ManifestValidationError.prototype);
  }
}

export class VersionCompatibilityError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VERSION_COMPATIBILITY_ERROR', details);
    Object.setPrototypeOf(this, VersionCompatibilityError.prototype);
  }
}

export class SandboxExecutionError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SANDBOX_EXECUTION_ERROR', details);
    Object.setPrototypeOf(this, SandboxExecutionError.prototype);
  }
}

export class TimeoutError extends SandboxExecutionError {
  constructor(timeoutMs: number, details?: Record<string, unknown>) {
    super(`Execution timed out after ${timeoutMs}ms`, { ...details, timeoutMs });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class MemoryExceededError extends SandboxExecutionError {
  constructor(usedBytes: number, limitBytes: number, details?: Record<string, unknown>) {
    super(`Memory exceeded: ${usedBytes} bytes used, limit is ${limitBytes} bytes`, { 
      ...details, 
      usedBytes, 
      limitBytes 
    });
    this.name = 'MemoryExceededError';
    Object.setPrototypeOf(this, MemoryExceededError.prototype);
  }
}

export class SchemaValidationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SCHEMA_VALIDATION_ERROR', details);
    Object.setPrototypeOf(this, SchemaValidationError.prototype);
  }
}

export class StorageError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', details);
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class ExportError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'EXPORT_ERROR', details);
    Object.setPrototypeOf(this, ExportError.prototype);
  }
}

export class CapabilityError extends BaseError {
  constructor(capability: string, message: string, details?: Record<string, unknown>) {
    super(message, `CAPABILITY_${capability.toUpperCase()}_ERROR`, { ...details, capability });
    this.name = 'CapabilityError';
    Object.setPrototypeOf(this, CapabilityError.prototype);
  }
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function errorToMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

export function errorToRecord(error: unknown): Record<string, unknown> {
  if (error instanceof BaseError) {
    return error.toJSON();
  }
  if (isError(error)) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { error };
}
