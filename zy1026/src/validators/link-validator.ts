import * as fs from 'fs';
import * as path from 'path';
import { CheckResult, Config, ExtractedLink, Heading } from '../types';
import { resolveRelativePath, parseAnchorFromHref, generateSlug, matchesIgnorePatterns } from '../utils';

export interface LinkValidationResult {
  valid: boolean;
  issues: CheckResult[];
}

export interface DocumentCache {
  headings: Map<string, Heading[]>;
  exists: Map<string, boolean>;
}

export class LinkValidator {
  private config: Config;
  private documentCache: DocumentCache;
  private docsDir: string;

  constructor(config: Config) {
    this.config = config;
    this.docsDir = path.resolve(process.cwd(), config.docsDir);
    this.documentCache = {
      headings: new Map(),
      exists: new Map()
    };
  }

  validateLocalLink(link: ExtractedLink, filePath: string): LinkValidationResult {
    const issues: CheckResult[] = [];
    const { file: targetFile, anchor } = parseAnchorFromHref(link.href);

    if (link.href.startsWith('mailto:') || link.href.startsWith('tel:')) {
      return { valid: true, issues };
    }

    if (link.href.startsWith('[') && link.href.endsWith(']')) {
      return {
        valid: true,
        issues: [{
          file: filePath,
          type: 'local',
          raw: link.raw,
          status: 'skipped',
          message: `引用式链接跳过检查: ${link.href}`,
          severity: 'info',
          line: link.line,
          column: link.column
        }]
      };
    }

    if (targetFile && !isAnchorOnly(link.href)) {
      const resolvedPath = this.resolveDocumentPath(filePath, targetFile);
      const checkPath = resolvedPath || resolveRelativePath(filePath, targetFile);
      const exists = this.checkDocumentExists(checkPath);
      
      if (!exists) {
        issues.push({
          file: filePath,
          type: 'local',
          raw: link.raw,
          resolved: checkPath,
          status: 'invalid',
          message: `目标文件不存在: ${targetFile}`,
          severity: this.config.severity.missingLink,
          line: link.line,
          column: link.column
        });
        return { valid: false, issues };
      }
    }

    if (anchor) {
      const anchorResult = this.validateAnchor(link, filePath, anchor, targetFile);
      if (!anchorResult.valid) {
        issues.push(...anchorResult.issues);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  validateAnchor(
    link: ExtractedLink,
    filePath: string,
    anchor: string,
    targetFile?: string
  ): LinkValidationResult {
    const issues: CheckResult[] = [];
    
    let targetFilePath = filePath;
    if (targetFile && !isAnchorOnly(link.href)) {
      const resolved = this.resolveDocumentPath(filePath, targetFile);
      if (resolved) {
        targetFilePath = resolved;
      }
    }

    const headings = this.getDocumentHeadings(targetFilePath);
    const anchorSlug = generateSlug(anchor, this.config.anchors.caseSensitive);
    
    const matchingHeading = headings.find(h => {
      const headingSlug = generateSlug(h.anchor, this.config.anchors.caseSensitive);
      return headingSlug === anchorSlug;
    });

    if (!matchingHeading) {
      const availableAnchors = headings.map(h => h.anchor).join(', ');
      issues.push({
        file: filePath,
        type: 'anchor',
        raw: link.raw,
        status: 'invalid',
        message: `锚点不存在: #${anchor}${targetFile !== filePath && targetFile ? ` (在 ${targetFile} 中)` : ''}\n  可用锚点: ${availableAnchors || '(无)'}`,
        severity: this.config.severity.invalidAnchor,
        line: link.line,
        column: link.column
      });
    }

    if (!this.config.anchors.allowDuplicates) {
      const duplicateAnchors = this.findDuplicateAnchors(headings);
      for (const dup of duplicateAnchors) {
        issues.push({
          file: targetFilePath,
          type: 'anchor',
          raw: `#${dup.anchor}`,
          status: 'warning',
          message: `重复的标题锚点: "${dup.text}" (出现 ${dup.count} 次)`,
          severity: this.config.severity.duplicateAnchor,
          line: dup.line
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  private resolveDocumentPath(sourcePath: string, targetPath: string): string | null {
    const resolved = resolveRelativePath(sourcePath, targetPath);
    
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }

    const possibleExtensions = ['.md', '.mdx', '.markdown'];
    for (const ext of possibleExtensions) {
      const withExt = resolved + ext;
      if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
        return withExt;
      }
    }

    const dirPath = resolved;
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      for (const ext of possibleExtensions) {
        const indexPath = path.join(dirPath, `index${ext}`);
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
          return indexPath;
        }
        const readmePath = path.join(dirPath, `README${ext}`);
        if (fs.existsSync(readmePath) && fs.statSync(readmePath).isFile()) {
          return readmePath;
        }
      }
    }

    return null;
  }

  private checkDocumentExists(filePath: string): boolean {
    if (this.documentCache.exists.has(filePath)) {
      return this.documentCache.exists.get(filePath)!;
    }

    const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    this.documentCache.exists.set(filePath, exists);
    return exists;
  }

  private getDocumentHeadings(filePath: string): Heading[] {
    if (this.documentCache.headings.has(filePath)) {
      return this.documentCache.headings.get(filePath)!;
    }

    const headings: Heading[] = [];
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const existingAnchors = new Set<string>();

      let inCodeBlock = false;

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const lineNumber = lineNum + 1;

        if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) {
          inCodeBlock = !inCodeBlock;
          continue;
        }

        if (inCodeBlock) continue;

        const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (atxMatch) {
          const level = atxMatch[1].length;
          const text = atxMatch[2].trim().replace(/\s+#+$/, '');
          const baseSlug = generateSlug(text, this.config.anchors.caseSensitive);
          
          let anchor = baseSlug;
          let counter = 1;
          while (existingAnchors.has(anchor)) {
            anchor = `${baseSlug}-${counter}`;
            counter++;
          }
          existingAnchors.add(anchor);

          headings.push({ text, level, anchor, line: lineNumber });
        }
      }
    }

    this.documentCache.headings.set(filePath, headings);
    return headings;
  }

  private findDuplicateAnchors(headings: Heading[]): Array<{ text: string; anchor: string; count: number; line: number }> {
    const anchorCounts = new Map<string, { texts: string[]; lines: number[]; count: number }>();

    for (const heading of headings) {
      const slug = generateSlug(heading.text, this.config.anchors.caseSensitive);
      if (!anchorCounts.has(slug)) {
        anchorCounts.set(slug, { texts: [], lines: [], count: 0 });
      }
      const entry = anchorCounts.get(slug)!;
      entry.texts.push(heading.text);
      entry.lines.push(heading.line);
      entry.count++;
    }

    const duplicates: Array<{ text: string; anchor: string; count: number; line: number }> = [];
    for (const [anchor, entry] of anchorCounts) {
      if (entry.count > 1) {
        duplicates.push({
          text: entry.texts[0],
          anchor,
          count: entry.count,
          line: entry.lines[0]
        });
      }
    }

    return duplicates;
  }

  clearCache(): void {
    this.documentCache.headings.clear();
    this.documentCache.exists.clear();
  }
}

function isAnchorOnly(href: string): boolean {
  return href.startsWith('#');
}
