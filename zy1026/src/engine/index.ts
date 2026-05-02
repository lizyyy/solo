import * as fs from 'fs';
import * as path from 'path';
import glob from 'fast-glob';
import { Config, RunResult, FileCheckResult, ExtractedLink, CheckResult, LinkType, ExternalCheckResult } from '../types';
import { MarkdownParser } from '../parser';
import { ImageValidator } from '../validators/image-validator';
import { LinkValidator } from '../validators/link-validator';
import { ExternalValidator } from '../validators/external-validator';
import { Reporter } from '../reporter';
import { matchesIgnorePatterns } from '../utils';

export class DocGuardEngine {
  private config: Config;
  private parser: MarkdownParser;
  private imageValidator: ImageValidator;
  private linkValidator: LinkValidator;
  private externalValidator: ExternalValidator;

  constructor(config: Config) {
    this.config = config;
    this.parser = new MarkdownParser({
      caseSensitiveAnchors: config.anchors.caseSensitive
    });
    this.imageValidator = new ImageValidator(config);
    this.linkValidator = new LinkValidator(config);
    this.externalValidator = new ExternalValidator(config);
  }

  async run(): Promise<RunResult> {
    const startTime = Date.now();

    const docFiles = await this.findDocFiles();
    const results: FileCheckResult[] = [];

    for (const filePath of docFiles) {
      const fileResult = await this.checkFile(filePath);
      results.push(fileResult);
    }

    if (this.config.external.enabled) {
      await this.checkExternalLinks(results);
    }

    this.externalValidator.saveCache();

    const runResult = this.buildRunResult(results, docFiles.length);

    return runResult;
  }

  private async findDocFiles(): Promise<string[]> {
    const docsDir = path.resolve(process.cwd(), this.config.docsDir);
    
    if (!fs.existsSync(docsDir)) {
      throw new Error(`文档目录不存在: ${docsDir}`);
    }

    const patterns = [
      path.join(docsDir, '**', '*.md'),
      path.join(docsDir, '**', '*.mdx'),
      path.join(docsDir, '**', '*.markdown')
    ];

    const files = await glob(patterns, {
      dot: true,
      ignore: this.config.ignorePatterns.map(p => {
        if (p.includes('**')) {
          return p;
        }
        return path.join(docsDir, '**', p);
      })
    });

    return files.map(f => path.resolve(f));
  }

  private async checkFile(filePath: string): Promise<FileCheckResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { links, headings } = this.parser.parse(content, filePath);

    const issues: CheckResult[] = [];

    for (const link of links) {
      const linkIssues = await this.validateLink(link, filePath);
      issues.push(...linkIssues);
    }

    return {
      filePath,
      links,
      issues
    };
  }

  private async validateLink(link: ExtractedLink, filePath: string): Promise<CheckResult[]> {
    const issues: CheckResult[] = [];

    switch (link.type) {
      case 'image':
        if (this.config.images.enabled) {
          const imgResult = this.imageValidator.validate(link, filePath);
          issues.push(...imgResult.issues);
          issues.push(...imgResult.warnings);
        }
        break;

      case 'local':
        const localResult = this.linkValidator.validateLocalLink(link, filePath);
        issues.push(...localResult.issues);
        break;

      case 'anchor':
        const anchorResult = this.linkValidator.validateAnchor(link, filePath, link.href.slice(1));
        issues.push(...anchorResult.issues);
        break;

      case 'external':
        break;
    }

    return issues;
  }

  private async checkExternalLinks(results: FileCheckResult[]): Promise<void> {
    const externalLinks: Map<string, Array<{ file: string; link: ExtractedLink }>> = new Map();

    for (const result of results) {
      for (const link of result.links) {
        if (link.type === 'external' && this.config.external.enabled) {
          if (!externalLinks.has(link.href)) {
            externalLinks.set(link.href, []);
          }
          externalLinks.get(link.href)!.push({
            file: result.filePath,
            link
          });
        }
      }
    }

    if (externalLinks.size === 0) {
      return;
    }

    const uniqueUrls = [...externalLinks.keys()];
    const checkResults = await this.externalValidator.validateBatch(uniqueUrls);

    for (const [url, result] of checkResults) {
      const occurrences = externalLinks.get(url) || [];
      
      if (result.status === 'invalid') {
        for (const { file, link } of occurrences) {
          const fileResult = results.find(r => r.filePath === file);
          if (fileResult) {
            const issue: CheckResult = {
              file,
              type: 'external',
              raw: link.raw,
              resolved: url,
              status: 'invalid',
              message: `外链检查失败: ${result.message}`,
              severity: this.config.severity.failedExternal,
              line: link.line,
              column: link.column
            };
            fileResult.issues.push(issue);
          }
        }
      } else if (result.status === 'warning') {
        for (const { file, link } of occurrences) {
          const fileResult = results.find(r => r.filePath === file);
          if (fileResult) {
            const issue: CheckResult = {
              file,
              type: 'external',
              raw: link.raw,
              resolved: url,
              status: 'warning',
              message: `外链警告: ${result.message}`,
              severity: 'warning',
              line: link.line,
              column: link.column
            };
            fileResult.issues.push(issue);
          }
        }
      }
    }
  }

  private buildRunResult(results: FileCheckResult[], totalFiles: number): RunResult {
    const filesWithIssues = results.filter(r => r.issues.length > 0).length;
    const totalLinks = results.reduce((sum, r) => sum + r.links.length, 0);
    
    const linkCounts = {
      images: 0,
      locals: 0,
      anchors: 0,
      externals: 0
    };

    for (const result of results) {
      for (const link of result.links) {
        switch (link.type) {
          case 'image': linkCounts.images++; break;
          case 'local': linkCounts.locals++; break;
          case 'anchor': linkCounts.anchors++; break;
          case 'external': linkCounts.externals++; break;
        }
      }
    }

    let totalIssues = 0;
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    const issuesByType: { [key in LinkType]: number } = {
      image: 0,
      local: 0,
      anchor: 0,
      external: 0
    };

    for (const result of results) {
      for (const issue of result.issues) {
        totalIssues++;
        issuesByType[issue.type]++;
        
        switch (issue.severity) {
          case 'error': errors++; break;
          case 'warning': warnings++; break;
          case 'info': infos++; break;
        }
      }
    }

    const exitCode = this.calculateExitCode(errors, warnings);

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      files: {
        total: totalFiles,
        checked: results.length,
        withIssues: filesWithIssues
      },
      links: {
        total: totalLinks,
        images: linkCounts.images,
        locals: linkCounts.locals,
        anchors: linkCounts.anchors,
        externals: linkCounts.externals
      },
      issues: {
        total: totalIssues,
        errors,
        warnings,
        infos,
        byType: issuesByType
      },
      results,
      exitCode
    };
  }

  private calculateExitCode(errors: number, warnings: number): number {
    if (errors > 0) {
      return 1;
    }
    if (warnings > 0) {
      return 2;
    }
    return 0;
  }
}
