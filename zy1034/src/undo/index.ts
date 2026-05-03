import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { Manifest, UndoResult, ManifestEntry, OperationType } from '../types';

export class UndoManager {
  async loadManifest(manifestPath: string): Promise<Manifest> {
    if (!manifestPath) {
      throw new Error('manifest 路径为空');
    }

    const exists = await fs.pathExists(manifestPath);
    if (!exists) {
      throw new Error(`manifest 文件不存在: ${manifestPath}`);
    }

    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as Manifest;
      
      this.validateManifest(manifest);
      
      return manifest;
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new Error(`manifest 文件格式错误: ${error.message}`);
      }
      throw error;
    }
  }

  loadManifestSync(manifestPath: string): Manifest {
    if (!manifestPath) {
      throw new Error('manifest 路径为空');
    }

    const exists = fs.existsSync(manifestPath);
    if (!exists) {
      throw new Error(`manifest 文件不存在: ${manifestPath}`);
    }

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as Manifest;
      
      this.validateManifest(manifest);
      
      return manifest;
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new Error(`manifest 文件格式错误: ${error.message}`);
      }
      throw error;
    }
  }

  async undo(manifest: Manifest, dryRun: boolean = false): Promise<UndoResult> {
    const result: UndoResult = {
      manifestId: manifest.id,
      totalEntries: manifest.entries.length,
      successfulRestores: 0,
      failedRestores: 0,
      skippedRestores: 0,
      errors: [],
      restoredFiles: []
    };

    const sortedEntries = [...manifest.entries].reverse();

    for (const entry of sortedEntries) {
      const undoResult = await this.undoEntry(entry, manifest.operationType, dryRun);
      
      if (undoResult.success) {
        result.successfulRestores++;
        if (undoResult.restoredPath) {
          result.restoredFiles.push({
            original: entry.originalPath,
            current: undoResult.restoredPath
          });
        }
      } else if (undoResult.skipped) {
        result.skippedRestores++;
      } else {
        result.failedRestores++;
        if (undoResult.error) {
          result.errors.push(undoResult.error);
        }
      }
    }

    return result;
  }

  private async undoEntry(
    entry: ManifestEntry,
    operationType: OperationType,
    dryRun: boolean
  ): Promise<{ success: boolean; skipped: boolean; error?: string; restoredPath?: string }> {
    if (entry.status === 'skipped') {
      return { success: true, skipped: true };
    }

    if (entry.status === 'failed') {
      return { success: true, skipped: true };
    }

    const currentSourceExists = await fs.pathExists(entry.newPath);
    const targetExists = await fs.pathExists(entry.originalPath);

    if (operationType === 'copy') {
      return {
        success: true,
        skipped: true,
        error: '复制操作无法撤销（源文件仍然存在）'
      };
    }

    if (!currentSourceExists) {
      return {
        success: false,
        skipped: false,
        error: `源文件不存在，无法恢复: ${entry.newPath}`
      };
    }

    if (targetExists) {
      const targetHash = await this.calculateFileHash(entry.originalPath);
      if (targetHash === entry.hash) {
        return {
          success: true,
          skipped: true,
          error: `目标位置已存在相同文件，跳过: ${entry.originalPath}`
        };
      }

      const uniquePath = await this.generateUniquePath(entry.originalPath);
      
      if (dryRun) {
        return {
          success: true,
          skipped: false,
          restoredPath: uniquePath
        };
      }

      try {
        const targetDir = path.dirname(uniquePath);
        await fs.ensureDir(targetDir);
        await fs.move(entry.newPath, uniquePath);
        
        return {
          success: true,
          skipped: false,
          restoredPath: uniquePath
        };
      } catch (error: any) {
        return {
          success: false,
          skipped: false,
          error: `恢复文件失败: ${entry.newPath} -> ${uniquePath} (${error.message})`
        };
      }
    }

    if (dryRun) {
      return {
        success: true,
        skipped: false,
        restoredPath: entry.originalPath
      };
    }

    try {
      const targetDir = path.dirname(entry.originalPath);
      await fs.ensureDir(targetDir);
      await fs.move(entry.newPath, entry.originalPath);
      
      return {
        success: true,
        skipped: false,
        restoredPath: entry.originalPath
      };
    } catch (error: any) {
      return {
        success: false,
        skipped: false,
        error: `恢复文件失败: ${entry.newPath} -> ${entry.originalPath} (${error.message})`
      };
    }
  }

  private validateManifest(manifest: Manifest): void {
    const errors: string[] = [];

    if (!manifest.id) {
      errors.push('manifest 缺少 id 字段');
    }

    if (!manifest.timestamp) {
      errors.push('manifest 缺少 timestamp 字段');
    }

    if (!manifest.entries || !Array.isArray(manifest.entries)) {
      errors.push('manifest entries 必须是数组');
    }

    if (manifest.entries) {
      manifest.entries.forEach((entry, index) => {
        if (!entry.originalPath) {
          errors.push(`entries[${index}] 缺少 originalPath`);
        }
        if (!entry.newPath) {
          errors.push(`entries[${index}] 缺少 newPath`);
        }
        if (!entry.operationType) {
          errors.push(`entries[${index}] 缺少 operationType`);
        }
        if (!entry.timestamp) {
          errors.push(`entries[${index}] 缺少 timestamp`);
        }
        if (!entry.hash) {
          errors.push(`entries[${index}] 缺少 hash`);
        }
        if (!entry.ruleName) {
          errors.push(`entries[${index}] 缺少 ruleName`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`manifest 不完整:\n${errors.join('\n')}`);
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(new Error(`计算文件哈希失败: ${filePath} (${error.message})`));
      });
    });
  }

  private async generateUniquePath(filePath: string): Promise<string> {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    let counter = 1;
    let newPath: string;

    do {
      newPath = path.join(dir, `${baseName}_restored_${counter}${ext}`);
      counter++;
    } while (await fs.pathExists(newPath));

    return newPath;
  }
}
