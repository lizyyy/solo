import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  CliOptions,
  LeakIssue,
  FileScanResult,
  ScanReport,
  ScanSummary,
  SourcemapReference,
  ExceptionRule,
} from './types';
import {
  generateId,
  normalizeFilePath,
  isJsFile,
  isSourcemapFile,
  joinPublicPath,
  formatDuration,
} from './utils';
import { parseFile, resolveSourcemapPath, checkSourcemapValidity } from './parser';
import { ExceptionLoader } from './exceptions';

export class SourcemapScanner {
  private options: CliOptions;
  private exceptionLoader: ExceptionLoader;
  private startTime: number = 0;

  constructor(options: CliOptions, exceptionLoader: ExceptionLoader) {
    this.options = options;
    this.exceptionLoader = exceptionLoader;
  }

  async scan(): Promise<ScanReport> {
    this.startTime = Date.now();
    const files = await this.collectFiles();

    const results: FileScanResult[] = [];
    const allIssues: LeakIssue[] = [];

    for (const file of files) {
      const result = await this.scanFile(file);
      results.push(result);
      allIssues.push(...result.issues);
    }

    const expiredExceptions = this.exceptionLoader.getExpiredRules();
    for (const rule of expiredExceptions) {
      const issue = this.createExpiredExceptionIssue(rule);
      allIssues.push(issue);
    }

    const summary = this.createSummary(results, allIssues, expiredExceptions);

    return {
      metadata: {
        version: this.getVersion(),
        timestamp: new Date().toISOString(),
        cliOptions: this.options,
      },
      summary,
      results,
      issues: allIssues,
      exceptions: {
        active: this.exceptionLoader.getActiveRules(),
        expired: expiredExceptions,
      },
    };
  }

  private async collectFiles(): Promise<string[]> {
    const targets = this.getScanTargets();
    const files: Set<string> = new Set();

    for (const target of targets) {
      const stat = await fs.promises.stat(target);

      if (stat.isDirectory()) {
        const matchedFiles = await glob('**/*.{js,mjs,cjs,map}', {
          cwd: target,
          absolute: true,
          nodir: true,
          ignore: ['**/node_modules/**'],
        });
        matchedFiles.forEach(f => files.add(f));
      } else if (stat.isFile()) {
        if (isJsFile(target) || isSourcemapFile(target)) {
          files.add(target);
        }
      }
    }

    return Array.from(files);
  }

  private getScanTargets(): string[] {
    const targets: string[] = [];

    if (this.options.dist) {
      targets.push(path.resolve(this.options.dist));
    }
    if (this.options.sourcemap) {
      targets.push(path.resolve(this.options.sourcemap));
    }
    if (this.options.js) {
      targets.push(path.resolve(this.options.js));
    }

    return [...new Set(targets)];
  }

  private async scanFile(filePath: string): Promise<FileScanResult> {
    const normalizedPath = normalizeFilePath(filePath);
    const fileType = isSourcemapFile(filePath) ? 'map' : isJsFile(filePath) ? 'js' : 'other';
    const isExcluded = this.exceptionLoader.isPathExcluded(filePath);
    const exceptionRule = this.exceptionLoader.getMatchingRule(filePath);

    const references: SourcemapReference[] = [];
    const issues: LeakIssue[] = [];

    if (fileType === 'js') {
      const refs = await parseFile(filePath);
      references.push(...refs);

      for (const ref of refs) {
        if (!isExcluded) {
          issues.push(this.createReferenceIssue(filePath, ref));
        }

        if (ref.type !== 'inline') {
          const resolvedPath = resolveSourcemapPath(filePath, ref.value);
          const publicUrl = this.getPublicUrl(resolvedPath);
          if (publicUrl && !isExcluded) {
            issues.push(this.createPublicAccessIssue(filePath, ref, publicUrl));
          }
        }
      }
    }

    if (fileType === 'map' && !isExcluded) {
      const isValid = await checkSourcemapValidity(filePath);
      if (isValid) {
        issues.push(this.createSourcemapFileIssue(filePath));
      }

      const publicUrl = this.getPublicUrl(filePath);
      if (publicUrl) {
        issues.push(this.createPublicMapFileIssue(filePath, publicUrl));
      }
    }

    return {
      filePath: normalizedPath,
      fileType,
      references,
      issues,
      isExcluded,
      exceptionRule,
    };
  }

  private createSourcemapFileIssue(filePath: string): LeakIssue {
    const relPath = this.getRelativePath(filePath);
    return {
      id: generateId('sourcemap_file', filePath),
      severity: 'critical',
      type: 'sourcemap_file',
      file: relPath,
      message: `发现 sourcemap 文件: ${relPath}`,
      details: {
        suggestedFix: '删除 sourcemap 文件或配置构建工具不生成 sourcemap',
      },
    };
  }

  private createReferenceIssue(filePath: string, ref: SourcemapReference): LeakIssue {
    const relPath = this.getRelativePath(filePath);
    const severity = ref.type === 'inline' ? 'high' : ref.type === 'hidden' ? 'critical' : 'high';

    return {
      id: generateId('reference', filePath, String(ref.line), String(ref.column)),
      severity,
      type: ref.type === 'hidden' ? 'hidden_sourcemap' : 'sourcemap_reference',
      file: relPath,
      line: ref.line,
      column: ref.column,
      message: `发现 ${this.getReferenceTypeName(ref.type)}: "${ref.value.substring(0, 50)}${ref.value.length > 50 ? '...' : ''}"`,
      details: {
        reference: ref,
        suggestedFix: this.getSuggestedFixForReference(ref),
      },
    };
  }

  private createPublicAccessIssue(filePath: string, ref: SourcemapReference, publicUrl: string): LeakIssue {
    const relPath = this.getRelativePath(filePath);
    return {
      id: generateId('public_access', filePath, publicUrl),
      severity: 'critical',
      type: 'publicly_accessible',
      file: relPath,
      line: ref.line,
      column: ref.column,
      message: `Sourcemap 可能公开可访问: ${publicUrl}`,
      details: {
        reference: ref,
        publicUrl,
        suggestedFix: '确保 sourcemap 文件不会被公开访问，或从构建产物中移除',
      },
    };
  }

  private createPublicMapFileIssue(filePath: string, publicUrl: string): LeakIssue {
    const relPath = this.getRelativePath(filePath);
    return {
      id: generateId('public_map', filePath),
      severity: 'critical',
      type: 'publicly_accessible',
      file: relPath,
      message: `Sourcemap 文件公开可访问: ${publicUrl}`,
      details: {
        publicUrl,
        suggestedFix: '从 Web 服务器配置中禁止 .map 文件访问，或删除 sourcemap 文件',
      },
    };
  }

  private createExpiredExceptionIssue(rule: ExceptionRule): LeakIssue {
    return {
      id: generateId('expired_exception', rule.path, rule.expiresAt || ''),
      severity: 'medium',
      type: 'expired_exception',
      file: rule.path,
      message: `例外规则已过期: ${rule.path}`,
      details: {
        exception: rule,
        suggestedFix: '更新例外规则的过期时间，或移除该例外并修复问题',
      },
    };
  }

  private getReferenceTypeName(type: string): string {
    const names: Record<string, string> = {
      comment: 'sourcemap 注释引用',
      hidden: '隐藏的 sourcemap 引用',
      url: 'sourcemap URL 引用',
      inline: '内联 sourcemap',
    };
    return names[type] || type;
  }

  private getSuggestedFixForReference(ref: SourcemapReference): string {
    switch (ref.type) {
      case 'inline':
        return '移除内联 sourcemap，配置构建工具生成独立文件并确保不公开';
      case 'hidden':
        return '检查代码中隐藏的 sourcemap 引用，可能在字符串或变量中';
      default:
        return '移除 sourceMappingURL 注释，或确保引用的 sourcemap 不公开';
    }
  }

  private getPublicUrl(filePath: string): string | null {
    if (!this.options.publicPath) return null;

    const baseDir = this.options.dist || process.cwd();
    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');

    if (relPath.startsWith('..')) return null;

    return joinPublicPath(this.options.publicPath, relPath);
  }

  private getRelativePath(filePath: string): string {
    const baseDir = this.options.dist || process.cwd();
    const relPath = path.relative(baseDir, filePath);
    return relPath.replace(/\\/g, '/');
  }

  private createSummary(
    results: FileScanResult[],
    issues: LeakIssue[],
    expiredExceptions: ExceptionRule[]
  ): ScanSummary {
    const duration = Date.now() - this.startTime;

    return {
      totalFiles: results.length,
      scannedFiles: results.filter(r => !r.isExcluded).length,
      excludedFiles: results.filter(r => r.isExcluded).length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
      expiredExceptions: expiredExceptions.length,
      scanDuration: duration,
      scanTimestamp: new Date().toISOString(),
    };
  }

  private getVersion(): string {
    try {
      const pkgPath = path.resolve(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }
}

export async function createScanner(
  options: CliOptions
): Promise<SourcemapScanner> {
  const exceptionLoader = new ExceptionLoader(options.exceptions);
  await exceptionLoader.load();
  return new SourcemapScanner(options, exceptionLoader);
}
