import * as fs from 'fs';
import * as path from 'path';
import { SubtitleFile, ScanResult, DeliveryRule, ValidationIssue } from './types';
import { SubtitleParser } from './subtitle-parser';
import { RulesEngine } from './rules-engine';

export class Scanner {
  private parser: SubtitleParser;
  private rulesEngine: RulesEngine;

  constructor(rules: DeliveryRule) {
    this.parser = new SubtitleParser();
    this.rulesEngine = new RulesEngine(rules);
  }

  scanDirectory(directoryPath: string): ScanResult {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`目录不存在: ${directoryPath}`);
    }

    const subtitleFiles = this.findSubtitleFiles(directoryPath);
    const parsedFiles: SubtitleFile[] = [];
    const allIssues: ValidationIssue[] = [];

    for (const filePath of subtitleFiles) {
      try {
        const parsed = this.parser.parseFile(filePath);
        parsedFiles.push(parsed);
        
        const issues = this.rulesEngine.validateFile(parsed);
        allIssues.push(...issues);
      } catch (error) {
        allIssues.push({
          file: path.basename(filePath),
          severity: 'error',
          category: 'format',
          message: `解析文件失败: ${(error as Error).message}`
        });
      }
    }

    const filesByPlatform: Record<string, SubtitleFile[]> = {};
    const filesByLanguage: Record<string, SubtitleFile[]> = {};

    for (const file of parsedFiles) {
      if (!filesByPlatform[file.platform]) {
        filesByPlatform[file.platform] = [];
      }
      filesByPlatform[file.platform].push(file);

      if (!filesByLanguage[file.language]) {
        filesByLanguage[file.language] = [];
      }
      filesByLanguage[file.language].push(file);
    }

    const languageCoverage = this.rulesEngine.checkLanguageCoverage(
      parsedFiles,
      this.rulesEngine.getRules().platforms
    );

    const errors = allIssues.filter(i => i.severity === 'error');
    const validFiles = parsedFiles.filter(file => 
      !errors.some(e => e.file === file.fileName)
    );

    return {
      totalFiles: parsedFiles.length,
      validFiles: validFiles.length,
      invalidFiles: parsedFiles.length - validFiles.length,
      filesByPlatform,
      filesByLanguage,
      issues: allIssues,
      languageCoverage
    };
  }

  private findSubtitleFiles(directoryPath: string): string[] {
    const files: string[] = [];
    
    const traverse = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.srt' || ext === '.vtt') {
            files.push(fullPath);
          }
        }
      }
    };

    traverse(directoryPath);
    return files;
  }

  getRules(): DeliveryRule {
    return this.rulesEngine.getRules();
  }

  updateRules(rules: DeliveryRule): void {
    this.rulesEngine.updateRules(rules);
  }
}
