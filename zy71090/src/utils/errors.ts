import { EXIT_CODES } from '../types';

export class CLIError extends Error {
  exitCode: number;
  
  constructor(message: string, exitCode: number = EXIT_CODES.ERROR_ANALYSIS_FAILED) {
    super(message);
    this.name = 'CLIError';
    this.exitCode = exitCode;
  }
}

export class ValidationError extends CLIError {
  constructor(message: string) {
    super(message, EXIT_CODES.ERROR_INVALID_ARGS);
    this.name = 'ValidationError';
  }
}

export class FileNotFoundError extends CLIError {
  constructor(filePath: string) {
    super(`文件不存在: ${filePath}`, EXIT_CODES.ERROR_FILE_NOT_FOUND);
    this.name = 'FileNotFoundError';
  }
}

export class ParseError extends CLIError {
  constructor(message: string) {
    super(message, EXIT_CODES.ERROR_PARSE_FAILED);
    this.name = 'ParseError';
  }
}

export class AnalysisError extends CLIError {
  constructor(message: string) {
    super(message, EXIT_CODES.ERROR_ANALYSIS_FAILED);
    this.name = 'AnalysisError';
  }
}

export function formatErrorMessage(error: unknown, verbose: boolean = false): string {
  if (error instanceof CLIError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return verbose ? error.stack || error.message : error.message;
  }
  
  return String(error);
}
