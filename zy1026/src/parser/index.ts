import * as path from 'path';
import { ExtractedLink, Heading, LinkType } from '../types';
import { isAnchor, isExternalUrl, isLocalLink, generateSlug, makeUniqueAnchor } from '../utils';

export interface ParserOptions {
  caseSensitiveAnchors?: boolean;
}

export class MarkdownParser {
  private caseSensitiveAnchors: boolean;

  constructor(options: ParserOptions = {}) {
    this.caseSensitiveAnchors = options.caseSensitiveAnchors || false;
  }

  parse(content: string, filePath: string): {
    links: ExtractedLink[];
    headings: Heading[];
  } {
    const lines = content.split('\n');
    const links: ExtractedLink[] = [];
    const headings: Heading[] = [];
    const existingAnchors = new Set<string>();

    let inCodeBlock = false;
    let inMdxBlock = false;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const lineNumber = lineNum + 1;

      if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (line.trim().startsWith('{/*') && !line.trim().includes('*/}')) {
        inMdxBlock = true;
        continue;
      }
      if (line.trim().includes('*/}') && inMdxBlock) {
        inMdxBlock = false;
        continue;
      }

      if (inCodeBlock || inMdxBlock) {
        continue;
      }

      const heading = this.parseHeading(line, lineNumber, existingAnchors);
      if (heading) {
        headings.push(heading);
      }

      const lineLinks = this.parseLineLinks(line, lineNumber, filePath);
      links.push(...lineLinks);

      const imageLinks = this.parseImageLinks(line, lineNumber, filePath);
      links.push(...imageLinks);

      const mdxImages = this.parseMdxImageSyntax(line, lineNumber, filePath);
      links.push(...mdxImages);

      const htmlLinks = this.parseHtmlLinks(line, lineNumber, filePath);
      links.push(...htmlLinks);
    }

    return { links, headings };
  }

  private parseHeading(line: string, lineNumber: number, existingAnchors: Set<string>): Heading | null {
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      const level = atxMatch[1].length;
      const text = atxMatch[2].trim().replace(/\s+#+$/, '');
      const baseSlug = generateSlug(text, this.caseSensitiveAnchors);
      const anchor = makeUniqueAnchor(baseSlug, existingAnchors);
      
      return { text, level, anchor, line: lineNumber };
    }

    return null;
  }

  private parseLineLinks(line: string, lineNumber: number, filePath: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    
    const linkPattern = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g;
    let match;
    
    while ((match = linkPattern.exec(line)) !== null) {
      const raw = match[0];
      const alt = match[1] || '';
      const href = match[2];
      const title = match[3];
      const column = match.index + 1;

      const isImage = raw.startsWith('!');
      const type = this.determineLinkType(href, isImage);

      links.push({
        type,
        raw,
        href,
        alt: alt || undefined,
        title,
        line: lineNumber,
        column
      });
    }

    const refLinkPattern = /!?\[([^\]]*)\]\[([^\]]*)\]/g;
    while ((match = refLinkPattern.exec(line)) !== null) {
      const raw = match[0];
      const alt = match[1] || '';
      const refId = match[2] || alt;
      const column = match.index + 1;

      if (!refId) continue;

      const isImage = raw.startsWith('!');
      links.push({
        type: isImage ? 'image' : 'local',
        raw,
        href: `[${refId}]`,
        alt: alt || undefined,
        line: lineNumber,
        column
      });
    }

    return links;
  }

  private parseImageLinks(line: string, lineNumber: number, filePath: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    
    const imgSrcPattern = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi;
    let match;

    while ((match = imgSrcPattern.exec(line)) !== null) {
      const raw = match[0];
      const href = match[1];
      const alt = match[2];
      const column = match.index + 1;

      const type = this.determineLinkType(href, true);

      links.push({
        type,
        raw,
        href,
        alt: alt || undefined,
        line: lineNumber,
        column
      });
    }

    return links;
  }

  private parseMdxImageSyntax(line: string, lineNumber: number, filePath: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    
    const mdxImportPattern = /import\s+(\w+)\s+from\s+['"]([^'"]+\.(?:png|jpg|jpeg|gif|svg|webp))['"]/gi;
    let match;

    while ((match = mdxImportPattern.exec(line)) !== null) {
      const raw = match[0];
      const href = match[2];
      const column = match.index + 1;

      links.push({
        type: 'image',
        raw,
        href,
        alt: match[1],
        line: lineNumber,
        column
      });
    }

    return links;
  }

  private parseHtmlLinks(line: string, lineNumber: number, filePath: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    
    const aTagPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;

    while ((match = aTagPattern.exec(line)) !== null) {
      const raw = match[0];
      const href = match[1];
      const text = match[2];
      const column = match.index + 1;

      const type = this.determineLinkType(href, false);

      links.push({
        type,
        raw,
        href,
        alt: text || undefined,
        line: lineNumber,
        column
      });
    }

    return links;
  }

  private determineLinkType(href: string, isImage: boolean): LinkType {
    if (isImage) {
      if (isExternalUrl(href)) {
        return 'external';
      }
      return 'image';
    }

    if (isExternalUrl(href)) {
      return 'external';
    }
    if (isAnchor(href)) {
      return 'anchor';
    }
    if (isLocalLink(href)) {
      return 'local';
    }

    return 'local';
  }
}
