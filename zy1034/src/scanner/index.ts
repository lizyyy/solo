import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileInfo, ScanResult, RulesConfig, MatchedFile, DuplicateFileGroup, ScanOptions } from '../types';
import { RuleMatcher } from '../rules';

export class FileScanner {
  private readonly rulesConfig: RulesConfig;
  private readonly matcher: RuleMatcher;

  constructor(rulesConfig: RulesConfig) {
    this.rulesConfig = rulesConfig;
    this.matcher = new RuleMatcher(rulesConfig);
  }

  async scan(directory: string, options: ScanOptions = { calculateHash: false, verbose: false }): Promise<ScanResult> {
    await this.validateDirectory(directory);

    const files = await this.getAllFiles(directory);
    const fileInfos: FileInfo[] = [];

    for (const file of files) {
      if (this.shouldExclude(file, directory)) {
        continue;
      }

      const fileInfo = await this.getFileInfo(file, options.calculateHash);
      fileInfos.push(fileInfo);
    }

    const matchedFiles: MatchedFile[] = [];
    const unmatchedFiles: FileInfo[] = [];

    for (const fileInfo of fileInfos) {
      const match = this.matcher.findMatchingRule(fileInfo);
      
      if (match) {
        const destinationPath = this.getDestinationPath(fileInfo, match.rule.destination);
        matchedFiles.push({
          ...fileInfo,
          ruleName: match.rule.name,
          rule: match.rule,
          destinationPath
        });
      } else {
        unmatchedFiles.push(fileInfo);
      }
    }

    const duplicateFiles = this.detectDuplicates(fileInfos);
    const potentialConflicts = await this.detectPotentialConflicts(matchedFiles);

    return {
      totalFiles: fileInfos.length,
      matchedFiles,
      unmatchedFiles,
      duplicateFiles,
      potentialConflicts
    };
  }

  private async validateDirectory(directory: string): Promise<void> {
    if (!directory) {
      throw new Error('目录路径为空');
    }

    const exists = await fs.pathExists(directory);
    if (!exists) {
      throw new Error(`目录不存在: ${directory}`);
    }

    const stat = await fs.stat(directory);
    if (!stat.isDirectory()) {
      throw new Error(`路径不是目录: ${directory}`);
    }

    try {
      await fs.access(directory, fs.constants.R_OK);
    } catch (error: any) {
      throw new Error(`目录没有读取权限: ${directory} (${error.message})`);
    }
  }

  private shouldExclude(filePath: string, baseDirectory: string): boolean {
    if (!this.rulesConfig.excludePatterns || this.rulesConfig.excludePatterns.length === 0) {
      return false;
    }

    const relativePath = path.relative(baseDirectory, filePath);

    return this.rulesConfig.excludePatterns.some(pattern => {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(relativePath) || regex.test(path.basename(relativePath));
    });
  }

  private async getAllFiles(directory: string): Promise<string[]> {
    const files: string[] = [];

    const items = await fs.readdir(directory, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(directory, item.name);
      
      if (item.isFile()) {
        files.push(fullPath);
      } else if (item.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      }
    }

    return files;
  }

  private async getFileInfo(filePath: string, calculateHash: boolean): Promise<FileInfo> {
    const stat = await fs.stat(filePath);
    const name = path.basename(filePath);
    const extension = path.extname(filePath);

    const fileInfo: FileInfo = {
      path: filePath,
      name,
      extension,
      size: stat.size,
      modifiedAt: stat.mtime,
      createdAt: stat.birthtime || stat.ctime
    };

    if (calculateHash) {
      fileInfo.hash = await this.calculateFileHash(filePath);
    }

    return fileInfo;
  }

  async calculateFileHash(filePath: string): Promise<string> {
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

  private getDestinationPath(fileInfo: FileInfo, destination: string): string {
    if (path.isAbsolute(destination)) {
      return path.join(destination, fileInfo.name);
    }
    return path.join(path.dirname(fileInfo.path), destination, fileInfo.name);
  }

  private detectDuplicates(fileInfos: FileInfo[]): DuplicateFileGroup[] {
    const hashToFiles: Map<string, string[]> = new Map();
    const sizeToFiles: Map<string, string[]> = new Map();

    for (const file of fileInfos) {
      if (file.hash) {
        const existing = hashToFiles.get(file.hash) || [];
        hashToFiles.set(file.hash, [...existing, file.path]);
      } else {
        const sizeKey = `${file.size}`;
        const existing = sizeToFiles.get(sizeKey) || [];
        sizeToFiles.set(sizeKey, [...existing, file.path]);
      }
    }

    const duplicateGroups: DuplicateFileGroup[] = [];

    for (const [hash, files] of hashToFiles) {
      if (files.length > 1) {
        duplicateGroups.push({
          hash,
          files
        });
      }
    }

    for (const [size, files] of sizeToFiles) {
      if (files.length > 1) {
        const existingGroup = duplicateGroups.find(g => 
          g.files.length === files.length && g.files.every(f => files.includes(f))
        );
        if (!existingGroup) {
          duplicateGroups.push({
            hash: `size:${size}`,
            files
          });
        }
      }
    }

    return duplicateGroups;
  }

  private async detectPotentialConflicts(matchedFiles: MatchedFile[]): Promise<any[]> {
    const conflicts: any[] = [];
    const destinationToFiles: Map<string, MatchedFile[]> = new Map();

    for (const matchedFile of matchedFiles) {
      const key = matchedFile.destinationPath;
      const existing = destinationToFiles.get(key) || [];
      destinationToFiles.set(key, [...existing, matchedFile]);
    }

    for (const [destinationPath, files] of destinationToFiles) {
      const exists = await fs.pathExists(destinationPath);
      
      if (exists && files.length === 1) {
        const existingStat = await fs.stat(destinationPath);
        conflicts.push({
          originalPath: files[0].path,
          targetPath: destinationPath,
          existingFile: {
            path: destinationPath,
            name: path.basename(destinationPath),
            extension: path.extname(destinationPath),
            size: existingStat.size,
            modifiedAt: existingStat.mtime,
            createdAt: existingStat.birthtime || existingStat.ctime
          },
          strategy: 'rename',
          resolved: false
        });
      }

      if (files.length > 1) {
        for (let i = 1; i < files.length; i++) {
          conflicts.push({
            originalPath: files[i].path,
            targetPath: destinationPath,
            existingFile: {
              path: files[i - 1].path,
              name: files[i - 1].name,
              extension: files[i - 1].extension,
              size: files[i - 1].size,
              modifiedAt: files[i - 1].modifiedAt,
              createdAt: files[i - 1].createdAt
            },
            strategy: 'rename',
            resolved: false
          });
        }
      }
    }

    return conflicts;
  }
}
