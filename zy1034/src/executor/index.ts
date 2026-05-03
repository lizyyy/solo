import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  MatchedFile,
  ConflictInfo,
  Manifest,
  ManifestEntry,
  ExecutionResult,
  ArchiveOptions,
  ConflictStrategy,
  OperationType,
  ScanResult
} from '../types';
import { FileScanner } from '../scanner';

export class FileExecutor {
  private readonly scanner: FileScanner;

  constructor(scanner: FileScanner) {
    this.scanner = scanner;
  }

  async execute(
    directory: string,
    options: ArchiveOptions
  ): Promise<ExecutionResult> {
    const scanResult = await this.scanner.scan(directory, {
      calculateHash: options.calculateHash,
      verbose: options.verbose
    });

    if (options.dryRun) {
      return this.buildDryRunResult(scanResult, options);
    }

    return this.executeActual(scanResult, directory, options);
  }

  private buildDryRunResult(
    scanResult: ScanResult,
    options: ArchiveOptions
  ): ExecutionResult {
    const dryRunConflicts: ConflictInfo[] = [];

    for (const matchedFile of scanResult.matchedFiles) {
      const exists = fs.existsSync(matchedFile.destinationPath);
      if (exists) {
        dryRunConflicts.push({
          originalPath: matchedFile.path,
          targetPath: matchedFile.destinationPath,
          existingFile: {
            path: matchedFile.destinationPath,
            name: path.basename(matchedFile.destinationPath),
            extension: path.extname(matchedFile.destinationPath),
            size: 0,
            modifiedAt: new Date(),
            createdAt: new Date()
          },
          strategy: options.conflictStrategy,
          resolved: false
        });
      }
    }

    return {
      ...scanResult,
      potentialConflicts: dryRunConflicts,
      successfulOperations: 0,
      failedOperations: 0,
      skippedOperations: 0,
      errors: []
    };
  }

  private async executeActual(
    scanResult: ScanResult,
    directory: string,
    options: ArchiveOptions
  ): Promise<ExecutionResult> {
    const manifestId = this.generateManifestId();
    const timestamp = new Date().toISOString();
    
    const manifest: Manifest = {
      id: manifestId,
      timestamp,
      sourceDirectory: directory,
      entries: [],
      operationType: options.operation,
      totalFiles: scanResult.matchedFiles.length
    };

    const errors: string[] = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const matchedFile of scanResult.matchedFiles) {
      const entry = await this.processFile(
        matchedFile,
        options,
        manifest
      );

      manifest.entries.push(entry);

      if (entry.status === 'success') {
        successful++;
      } else if (entry.status === 'failed') {
        failed++;
        if (entry.errorMessage) {
          errors.push(entry.errorMessage);
        }
      } else if (entry.status === 'skipped') {
        skipped++;
      }
    }

    if (options.outputManifest) {
      await this.saveManifest(manifest, options.outputManifest);
    }

    return {
      ...scanResult,
      manifest,
      successfulOperations: successful,
      failedOperations: failed,
      skippedOperations: skipped,
      errors
    };
  }

  private async processFile(
    matchedFile: MatchedFile,
    options: ArchiveOptions,
    manifest: Manifest
  ): Promise<ManifestEntry> {
    const baseEntry: ManifestEntry = {
      originalPath: matchedFile.path,
      newPath: matchedFile.destinationPath,
      operationType: options.operation,
      timestamp: manifest.timestamp,
      fileSize: matchedFile.size,
      hash: matchedFile.hash || '',
      ruleName: matchedFile.ruleName,
      status: 'success'
    };

    try {
      const conflictInfo = await this.handleConflict(
        matchedFile,
        options.conflictStrategy
      );

      if (conflictInfo) {
        baseEntry.conflictInfo = conflictInfo;
        
        if (!conflictInfo.resolved) {
          baseEntry.status = 'skipped';
          return baseEntry;
        }

        if (conflictInfo.resolvedPath) {
          baseEntry.newPath = conflictInfo.resolvedPath;
        }
      }

      const targetDir = path.dirname(baseEntry.newPath);
      await fs.ensureDir(targetDir);

      if (options.operation === 'move') {
        await fs.move(matchedFile.path, baseEntry.newPath);
      } else {
        await fs.copy(matchedFile.path, baseEntry.newPath);
      }

      if (baseEntry.hash === '' && options.calculateHash) {
        baseEntry.hash = await this.scanner.calculateFileHash(baseEntry.newPath);
      }

      return baseEntry;
    } catch (error: any) {
      return {
        ...baseEntry,
        status: 'failed',
        errorMessage: `处理文件 ${matchedFile.path} 失败: ${error.message}`
      };
    }
  }

  private async handleConflict(
    matchedFile: MatchedFile,
    strategy: ConflictStrategy
  ): Promise<ConflictInfo | null> {
    const targetExists = await fs.pathExists(matchedFile.destinationPath);
    
    if (!targetExists) {
      return null;
    }

    const existingStat = await fs.stat(matchedFile.destinationPath);
    const existingFileInfo = {
      path: matchedFile.destinationPath,
      name: path.basename(matchedFile.destinationPath),
      extension: path.extname(matchedFile.destinationPath),
      size: existingStat.size,
      modifiedAt: existingStat.mtime,
      createdAt: existingStat.birthtime || existingStat.ctime
    };

    const conflictInfo: ConflictInfo = {
      originalPath: matchedFile.path,
      targetPath: matchedFile.destinationPath,
      existingFile: existingFileInfo,
      strategy,
      resolved: false
    };

    switch (strategy) {
      case 'error':
        throw new Error(`目标文件已存在: ${matchedFile.destinationPath}`);
      
      case 'skip':
        conflictInfo.resolved = false;
        return conflictInfo;
      
      case 'rename':
        const renamedPath = await this.generateUniquePath(matchedFile.destinationPath);
        conflictInfo.resolvedPath = renamedPath;
        conflictInfo.resolved = true;
        return conflictInfo;
      
      default:
        throw new Error(`未知的冲突策略: ${strategy}`);
    }
  }

  private async generateUniquePath(filePath: string): Promise<string> {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    let counter = 1;
    let newPath: string;

    do {
      newPath = path.join(dir, `${baseName}_${counter}${ext}`);
      counter++;
    } while (await fs.pathExists(newPath));

    return newPath;
  }

  private async saveManifest(manifest: Manifest, outputPath: string): Promise<void> {
    try {
      const dir = path.dirname(outputPath);
      await fs.ensureDir(dir);
      
      const content = JSON.stringify(manifest, null, 2);
      await fs.writeFile(outputPath, content, 'utf-8');
    } catch (error: any) {
      throw new Error(`保存 manifest 失败: ${error.message}`);
    }
  }

  private generateManifestId(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `manifest_${timestamp}_${random}`;
  }
}
