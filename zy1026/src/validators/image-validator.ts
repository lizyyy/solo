import * as fs from 'fs';
import * as path from 'path';
import { CheckResult, SnapshotsManifest, Config, ExtractedLink } from '../types';
import { resolveRelativePath, getFileHash, getFileMtime } from '../utils';

export interface ImageValidationResult {
  valid: boolean;
  issues: CheckResult[];
  warnings: CheckResult[];
}

export class ImageValidator {
  private config: Config;
  private manifest: SnapshotsManifest | null = null;

  constructor(config: Config) {
    this.config = config;
    this.loadManifest();
  }

  private loadManifest(): void {
    if (!this.config.images.manifestPath) {
      return;
    }

    try {
      const manifestPath = path.resolve(process.cwd(), this.config.images.manifestPath);
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        this.manifest = JSON.parse(content);
      }
    } catch (error) {
      console.warn(`警告: 无法加载快照清单文件: ${(error as Error).message}`);
    }
  }

  validate(link: ExtractedLink, filePath: string): ImageValidationResult {
    const issues: CheckResult[] = [];
    const warnings: CheckResult[] = [];

    if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
      return { valid: true, issues, warnings };
    }

    if (link.href.startsWith('data:')) {
      return { valid: true, issues, warnings };
    }

    if (link.href.startsWith('[') && link.href.endsWith(']')) {
      warnings.push({
        file: filePath,
        type: 'image',
        raw: link.raw,
        status: 'skipped',
        message: `引用式图片链接跳过检查: ${link.href}`,
        severity: 'info',
        line: link.line,
        column: link.column
      });
      return { valid: true, issues, warnings };
    }

    const resolvedPath = resolveRelativePath(filePath, link.href);
    const exists = fs.existsSync(resolvedPath);

    if (!exists) {
      issues.push({
        file: filePath,
        type: 'image',
        raw: link.raw,
        resolved: resolvedPath,
        status: 'invalid',
        message: `图片文件不存在: ${link.href}`,
        severity: this.config.severity.missingImage,
        line: link.line,
        column: link.column
      });
      return { valid: false, issues, warnings };
    }

    const manifestIssue = this.checkManifest(link, resolvedPath, filePath);
    if (manifestIssue) {
      if (manifestIssue.severity === 'warning' || manifestIssue.severity === 'info') {
        warnings.push(manifestIssue);
      } else {
        issues.push(manifestIssue);
      }
    }

    return { valid: issues.length === 0, issues, warnings };
  }

  private checkManifest(
    link: ExtractedLink,
    resolvedPath: string,
    filePath: string
  ): CheckResult | null {
    if (!this.manifest || !this.manifest.snapshots) {
      return null;
    }

    const relativePath = this.getManifestRelativePath(resolvedPath);
    
    const manifestEntry = Object.entries(this.manifest.snapshots).find(
      ([key]) => key === link.href || key === relativePath
    );

    if (!manifestEntry) {
      return null;
    }

    const [manifestKey, entry] = manifestEntry;
    const messages: string[] = [];

    if (this.config.images.checkMtime && entry.mtime !== undefined) {
      const currentMtime = getFileMtime(resolvedPath);
      if (Math.abs(currentMtime - entry.mtime) > 1000) {
        messages.push(`修改时间不一致 (期望: ${new Date(entry.mtime).toISOString()}, 实际: ${new Date(currentMtime).toISOString()})`);
      }
    }

    if (this.config.images.checkHash && entry.hash) {
      const currentHash = getFileHash(resolvedPath);
      if (currentHash !== entry.hash) {
        messages.push(`文件哈希不一致`);
      }
    }

    if (messages.length > 0) {
      const note = entry.note ? ` - ${entry.note}` : '';
      return {
        file: filePath,
        type: 'image',
        raw: link.raw,
        resolved: resolvedPath,
        status: 'warning',
        message: `截图可能已过期: ${link.href}${note}\n  ${messages.join('\n  ')}`,
        severity: this.config.severity.expiredImage,
        line: link.line,
        column: link.column
      };
    }

    return null;
  }

  private getManifestRelativePath(fullPath: string): string {
    const docsDir = path.resolve(process.cwd(), this.config.docsDir);
    if (fullPath.startsWith(docsDir)) {
      return path.relative(docsDir, fullPath);
    }
    return fullPath;
  }

  getManifest(): SnapshotsManifest | null {
    return this.manifest;
  }
}
