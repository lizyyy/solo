import * as path from 'path';
import * as marked from 'marked';
import { JSDOM } from 'jsdom';
import { parse as parseYaml } from 'yaml';
import {
  Frontmatter,
  ParsedDocument,
  LinkInfo,
  ImageInfo,
  CodeSnippet,
  SectionInfo,
} from '../types';
import {
  isExternalLink,
  isAnchorLink,
  slugify,
  generateId,
  isDangerousCode,
  RUNNABLE_LANGUAGES,
  normalizePath,
} from '../utils';

export interface ParserOptions {
  basePath: string;
}

export class Parser {
  private options: ParserOptions;

  constructor(options: ParserOptions) {
    this.options = options;
  }

  parseFrontmatter(content: string): { frontmatter: Frontmatter; content: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const frontmatter = parseYaml(match[1]) || {};
        return {
          frontmatter,
          content: content.slice(match[0].length),
        };
      } catch {
        return {
          frontmatter: {},
          content,
        };
      }
    }

    return {
      frontmatter: {},
      content,
    };
  }

  private getLineAndColumn(content: string, charIndex: number): { line: number; column: number } {
    const lines = content.substring(0, charIndex).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  private findSectionForLine(sections: SectionInfo[], line: number): string {
    const section = sections
      .filter(s => s.line <= line)
      .sort((a, b) => b.line - a.line)[0];
    return section ? section.title : '';
  }

  private parseMarkdownLinks(content: string): LinkInfo[] {
    const links: LinkInfo[] = [];
    
    const inlineLinkRegex = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
    let match;
    
    while ((match = inlineLinkRegex.exec(content)) !== null) {
      const text = match[1];
      const href = match[2];
      const pos = this.getLineAndColumn(content, match.index);

      let type: 'internal' | 'external' | 'anchor' = 'internal';
      if (isExternalLink(href)) {
        type = 'external';
      } else if (isAnchorLink(href)) {
        type = 'anchor';
      }

      links.push({
        href,
        text,
        type,
        line: pos.line,
        column: pos.column,
      });
    }

    const referenceLinkRegex = /\[([^\]]*)\]\[([^\]]*)\]/g;
    while ((match = referenceLinkRegex.exec(content)) !== null) {
      const text = match[1];
      const reference = match[2] || text;
      const pos = this.getLineAndColumn(content, match.index);

      const referenceDefRegex = new RegExp(`\\[${reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]:\\s*(\\S+)`, 'm');
      const refMatch = content.match(referenceDefRegex);
      
      if (refMatch) {
        const href = refMatch[1];
        let type: 'internal' | 'external' | 'anchor' = 'internal';
        if (isExternalLink(href)) {
          type = 'external';
        } else if (isAnchorLink(href)) {
          type = 'anchor';
        }

        links.push({
          href,
          text,
          type,
          line: pos.line,
          column: pos.column,
        });
      }
    }

    const autolinkRegex = /<(https?:\/\/[^>]+)>/g;
    while ((match = autolinkRegex.exec(content)) !== null) {
      const href = match[1];
      const pos = this.getLineAndColumn(content, match.index);

      links.push({
        href,
        text: href,
        type: 'external',
        line: pos.line,
        column: pos.column,
      });
    }

    return links;
  }

  private parseMarkdownImages(content: string): ImageInfo[] {
    const images: ImageInfo[] = [];
    
    const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      const alt = match[1];
      const src = match[2];
      const pos = this.getLineAndColumn(content, match.index);

      images.push({
        src,
        alt,
        line: pos.line,
        column: pos.column,
      });
    }

    return images;
  }

  private parseMarkdownCodeBlocks(content: string, filename: string, sections: SectionInfo[]): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    
    const codeBlockRegex = /```([\w+]*)?\s*\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || '';
      const code = match[2].trim();
      const pos = this.getLineAndColumn(content, match.index);

      const isRunnable = RUNNABLE_LANGUAGES.includes(language.toLowerCase());
      const isDangerous = isDangerousCode(language, code);

      snippets.push({
        id: generateId(),
        language: language.toLowerCase(),
        code,
        filename,
        line: pos.line,
        column: pos.column,
        file: filename,
        section: this.findSectionForLine(sections, pos.line),
        isDangerous: isRunnable && isDangerous,
      });
    }

    return snippets;
  }

  private parseMarkdownSections(content: string): SectionInfo[] {
    const sections: SectionInfo[] = [];
    
    const atxHeaderRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    
    while ((match = atxHeaderRegex.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const pos = this.getLineAndColumn(content, match.index);

      sections.push({
        title,
        level,
        anchor: slugify(title),
        line: pos.line,
      });
    }

    const setextHeaderRegex = /^(.+)\n[=-]+$/gm;
    while ((match = setextHeaderRegex.exec(content)) !== null) {
      const title = match[1].trim();
      const level = match[0].endsWith('=') ? 1 : 2;
      const pos = this.getLineAndColumn(content, match.index);

      sections.push({
        title,
        level,
        anchor: slugify(title),
        line: pos.line,
      });
    }

    return sections.sort((a, b) => a.line - b.line);
  }

  private parseHtmlLinks(content: string, filename: string): LinkInfo[] {
    const links: LinkInfo[] = [];
    
    try {
      const dom = new JSDOM(content, { url: 'file://' + filename });
      const anchorElements = dom.window.document.querySelectorAll('a[href]');

      anchorElements.forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        const text = anchor.textContent || '';

        let type: 'internal' | 'external' | 'anchor' = 'internal';
        if (isExternalLink(href)) {
          type = 'external';
        } else if (isAnchorLink(href)) {
          type = 'anchor';
        }

        links.push({
          href,
          text,
          type,
          line: 1,
          column: 1,
        });
      });
    } catch {
      // 忽略解析错误
    }

    return links;
  }

  private parseHtmlImages(content: string, filename: string): ImageInfo[] {
    const images: ImageInfo[] = [];
    
    try {
      const dom = new JSDOM(content, { url: 'file://' + filename });
      const imgElements = dom.window.document.querySelectorAll('img[src]');

      imgElements.forEach((img) => {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';

        images.push({
          src,
          alt,
          line: 1,
          column: 1,
        });
      });
    } catch {
      // 忽略解析错误
    }

    return images;
  }

  private parseHtmlSections(content: string, filename: string): SectionInfo[] {
    const sections: SectionInfo[] = [];
    
    try {
      const dom = new JSDOM(content, { url: 'file://' + filename });
      
      for (let level = 1; level <= 6; level++) {
        const headingElements = dom.window.document.querySelectorAll(`h${level}`);
        
        headingElements.forEach((heading) => {
          const title = heading.textContent?.trim() || '';
          const id = heading.getAttribute('id') || slugify(title);

          sections.push({
            title,
            level,
            anchor: id,
            line: 1,
          });
        });
      }
    } catch {
      // 忽略解析错误
    }

    return sections;
  }

  async parseMarkdown(content: string, filename: string): Promise<ParsedDocument> {
    const { frontmatter, content: bodyContent } = this.parseFrontmatter(content);

    const sections = this.parseMarkdownSections(bodyContent);
    const links = this.parseMarkdownLinks(bodyContent);
    const images = this.parseMarkdownImages(bodyContent);
    const codeSnippets = this.parseMarkdownCodeBlocks(bodyContent, filename, sections);

    return {
      path: normalizePath(filename),
      frontmatter,
      content: bodyContent,
      links,
      images,
      codeSnippets,
      sections,
    };
  }

  async parseHtml(content: string, filename: string): Promise<ParsedDocument> {
    const { frontmatter, content: bodyContent } = this.parseFrontmatter(content);

    const sections = this.parseHtmlSections(bodyContent, filename);
    const links = this.parseHtmlLinks(bodyContent, filename);
    const images = this.parseHtmlImages(bodyContent, filename);

    return {
      path: normalizePath(filename),
      frontmatter,
      content: bodyContent,
      links,
      images,
      codeSnippets: [],
      sections,
    };
  }
}
