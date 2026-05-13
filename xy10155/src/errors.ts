export class CLIError extends Error {
  public readonly exitCode: number;

  constructor(message: string, exitCode: number = 1) {
    super(message);
    this.name = 'CLIError';
    this.exitCode = exitCode;
  }
}

export function exitWithError(message: string, exitCode: number = 1): never {
  throw new CLIError(message, exitCode);
}
