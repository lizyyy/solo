import * as path from 'path';
import {
  ParsedDocument,
  Issue,
  ValidateResult,
  LinkInfo,
  ImageInfo,
  SectionInfo,
  Config,
  IssueType,
} from '../types';
import {
  isExternalLink,
  isAnchorLink,
  fileExists,
  resolveRelativeLink,
  createIssue,
  normalizePath,
} from '../utils';

export interface ValidatorOptions {
  rootPath: string;
  config: Config;
  documents: Map<string, ParsedDocument>;
}

export class Validator {
  private options: ValidatorOptions;
  private issues: Issue[] = [];

  constructor(options: ValidatorOptions) {
    this.options = options;
  }

  private shouldIgnoreLink(href: string): boolean {
    const ignoreLinks = this.options.config.ignore.links;
    return ignoreLinks.some(pattern => {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        'i'
      );
      return regex.test(href);
    });
  }

  private validateInternalLink(
    link: LinkInfo,
    doc: ParsedDocument,
    allDocs: Map<string, ParsedDocument>
  ): void {
    const href = link.href;
    
    if (this.shouldIgnoreLink(href)) {
      return;
    }

    const withoutAnchor = href.split('#')[0];
    const hasAnchor = href.includes('#');
    const anchorPart = hasAnchor ? href.split('#')[1] : null;

    let targetFile: string;
    let targetDoc: ParsedDocument | undefined;

    if (withoutAnchor === '' || withoutAnchor === '.' || withoutAnchor === './') {
      targetFile = doc.path;
      targetDoc = doc;
    } else {
      const fullPath = resolveRelativeLink(
        path.join(this.options.rootPath, doc.path),
        withoutAnchor
      );
      const relativePath = normalizePath(path.relative(this.options.rootPath, fullPath));

      if (!fileExists(fullPath)) {
        this.issues.push(
          createIssue(
            'missing_file' as IssueType,
            `链接指向的文件不存在: ${href} (解析路径: ${fullPath})`,
            doc.path,
            link.line,
            link.column,
            `上下文: [${link.text}](${href})`
          )
        );
        return;
      }

      targetFile = relativePath;
      targetDoc = allDocs.get(relativePath);
    }

    if (hasAnchor && anchorPart && targetDoc) {
      const anchorExists = targetDoc.sections.some(
        s => s.anchor === anchorPart || s.title === decodeURIComponent(anchorPart)
      );

      if (!anchorExists) {
        this.issues.push(
          createIssue(
            'bad_anchor' as IssueType,
            `锚点不存在: #${anchorPart} (在文件: ${targetFile}中)`,
            doc.path,
            link.line,
            link.column,
            `上下文: [${link.text}](${href})`
          )
        );
      }
    }
  }

  private validateExternalLink(
    link: LinkInfo,
    doc: ParsedDocument
  ): void {
    if (!this.options.config.validation.checkExternalLinks) {
      return;
    }
  }

  private validateAnchorLink(
    link: LinkInfo,
    doc: ParsedDocument
  ): void {
    const anchor = link.href.substring(1);
    const anchorExists = doc.sections.some(
      s => s.anchor === anchor || s.title === decodeURIComponent(anchor)
    );

    if (!anchorExists) {
      this.issues.push(
        createIssue(
          'bad_anchor' as IssueType,
          `页面内锚点不存在: #${anchor}`,
          doc.path,
          link.line,
          link.column,
          `上下文: [${link.text}](${link.href})`
        )
      );
    }
  }

  private validateLinks(doc: ParsedDocument): void {
    for (const link of doc.links) {
      switch (link.type) {
        case 'internal':
          this.validateInternalLink(link, doc, this.options.documents);
          break;
        case 'external':
          this.validateExternalLink(link, doc);
          break;
        case 'anchor':
          this.validateAnchorLink(link, doc);
          break;
      }
    }
  }

  private validateImages(doc: ParsedDocument): void {
    for (const image of doc.images) {
      if (isExternalLink(image.src)) {
        continue;
      }

      if (this.shouldIgnoreLink(image.src)) {
        continue;
      }

      const fullPath = resolveRelativeLink(
        path.join(this.options.rootPath, doc.path),
        image.src
      );

      if (!fileExists(fullPath)) {
        this.issues.push(
          createIssue(
            'missing_file' as IssueType,
            `图片不存在: ${image.src} (解析路径: ${fullPath})`,
            doc.path,
            image.line,
            image.column,
            `上下文: ![${image.alt}](${image.src})`
          )
        );
      }
    }
  }

  private validateDocument(doc: ParsedDocument): void {
    this.validateLinks(doc);
    this.validateImages(doc);
  }

  async validate(): Promise<ValidateResult> {
    this.issues = [];

    for (const [_, doc] of this.options.documents) {
      this.validateDocument(doc);
    }

    const byType: Record<IssueType, number> = {
      missing_file: 0,
      broken_link: 0,
      bad_anchor: 0,
      code_error: 0,
      dangerous_command: 0,
      config_error: 0,
    };

    let errors = 0;
    let warnings = 0;
    let info = 0;

    for (const issue of this.issues) {
      byType[issue.type]++;
      switch (issue.severity) {
        case 'error':
          errors++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'info':
          info++;
          break;
      }
    }

    return {
      validatedAt: new Date(),
      rootPath: normalizePath(this.options.rootPath),
      issues: this.issues,
      scannedFiles: this.options.documents.size,
      summary: {
        totalIssues: this.issues.length,
        byType,
        bySeverity: {
          errors,
          warnings,
          info,
        },
      },
    };
  }
}
