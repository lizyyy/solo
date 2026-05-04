import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { FileInfo, FileType, ScanResult } from '../types';
import { getFileType, normalizePath } from '../utils';

export interface ScannerOptions {
  rootPath: string;
  ignorePatterns?: string[];
  includeExtensions?: string[];
}

export class Scanner {
  private options: ScannerOptions;
  private defaultIgnorePatterns = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'reports/**',
    '*.log',
    '.DS_Store',
    'Thumbs.db',
  ];

  constructor(options: ScannerOptions) {
    this.options = options;
  }

  private getIgnorePatterns(): string[] {
    return [
      ...this.defaultIgnorePatterns,
      ...(this.options.ignorePatterns || []),
    ];
  }

  async scan(): Promise<ScanResult> {
    const rootPath = path.resolve(this.options.rootPath);
    
    const globPattern = '**/*';
    const ignorePatterns = this.getIgnorePatterns();

    const filePaths = await glob(globPattern, {
      cwd: rootPath,
      ignore: ignorePatterns,
      nodir: true,
      dot: false,
    });

    const files: FileInfo[] = [];
    const byType: Record<FileType, number> = {
      markdown: 0,
      html: 0,
      image: 0,
      attachment: 0,
      code: 0,
      other: 0,
    };

    for (const filePath of filePaths) {
      const fullPath = path.join(rootPath, filePath);
      const stats = fs.statSync(fullPath);
      const fileType = getFileType(fullPath);

      files.push({
        path: normalizePath(filePath),
        name: path.basename(filePath),
        type: fileType,
        extension: path.extname(filePath),
        size: stats.size,
        lastModified: stats.mtime,
      });

      byType[fileType]++;
    }

    return {
      scannedAt: new Date(),
      rootPath: normalizePath(rootPath),
      files,
      summary: {
        totalFiles: files.length,
        byType,
      },
    };
  }

  async scanDocuments(): Promise<string[]> {
    const rootPath = path.resolve(this.options.rootPath);
    const ignorePatterns = this.getIgnorePatterns();

    const markdownFiles = await glob('**/*.{md,markdown}', {
      cwd: rootPath,
      ignore: ignorePatterns,
      nodir: true,
    });

    const htmlFiles = await glob('**/*.{html,htm}', {
      cwd: rootPath,
      ignore: ignorePatterns,
      nodir: true,
    });

    return [...markdownFiles, ...htmlFiles].map(f => normalizePath(f));
  }
}
