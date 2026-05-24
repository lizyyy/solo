import { DiffResult, ExitCodeExplanations } from '../types';
import * as path from 'path';

export abstract class BaseReporter {
  protected result: DiffResult;
  protected outputDir: string;
  protected expectedFile: string;
  protected actualFile: string;

  constructor(
    result: DiffResult,
    outputDir: string,
    expectedFile: string,
    actualFile: string
  ) {
    this.result = result;
    this.outputDir = outputDir;
    this.expectedFile = expectedFile;
    this.actualFile = actualFile;
  }

  abstract generate(): string | Promise<string>;

  protected getRelativePath(filePath: string): string {
    try {
      return path.relative(process.cwd(), filePath);
    } catch {
      return filePath;
    }
  }

  protected formatSourceLink(filePath: string, line?: number): string {
    const relPath = this.getRelativePath(filePath);
    return line ? `${relPath}:${line}` : relPath;
  }

  protected getExitCodeExplanation(): typeof ExitCodeExplanations[0] {
    const explanation = ExitCodeExplanations.find(e => e.code === this.result.exitCode);
    return explanation || ExitCodeExplanations[ExitCodeExplanations.length - 1];
  }
}
