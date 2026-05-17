import { glob } from 'glob';
import * as path from 'path';
import { CliOptions } from './types';

export class FileScanner {
  private options: CliOptions;
  private sourceDir: string;

  constructor(options: CliOptions) {
    this.options = options;
    this.sourceDir = path.resolve(options.source);
  }

  async findRouteFiles(): Promise<string[]> {
    const files = await this.findFiles(this.options.routePatterns);
    return files.filter(f => !this.isExcluded(f));
  }

  async findPageFiles(): Promise<string[]> {
    const files = await this.findFiles(this.options.pagePatterns);
    return files.filter(f => !this.isExcluded(f));
  }

  private async findFiles(patterns: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.sourceDir,
        absolute: true,
        nodir: true,
        dot: false
      });
      allFiles.push(...matches);
    }

    return [...new Set(allFiles)];
  }

  private isExcluded(filePath: string): boolean {
    const relativePath = path.relative(this.sourceDir, filePath);
    return this.options.excludePatterns.some(pattern => {
      const regex = new RegExp(
        '^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
      );
      return regex.test(relativePath);
    });
  }

  getRelativePath(filePath: string): string {
    return path.relative(this.sourceDir, filePath);
  }
}