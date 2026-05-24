import fs from 'fs/promises';
import * as csstree from 'css-tree';
import crypto from 'crypto';
import { FontReference, FontFormat, ReferenceSource } from '../types.js';
import { scanDirectory, getFileExtension, getRelativePath } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

export class CssParser {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  async parseAll(includeRemote = true, verbose = false): Promise<FontReference[]> {
    logger.debug(`开始解析 CSS 文件: ${this.projectDir}`, verbose);

    const patterns = ['**/*.css', '**/*.scss', '**/*.sass', '**/*.html'];
    const files = await scanDirectory(this.projectDir, patterns);

    const references: FontReference[] = [];

    for (const filePath of files) {
      const ext = getFileExtension(filePath);
      const source = this.getSourceType(ext);

      if (ext === 'css' || ext === 'scss' || ext === 'sass') {
        const refs = await this.parseStylesheet(filePath, source, includeRemote, verbose);
        references.push(...refs);
      } else if (ext === 'html' || ext === 'htm') {
        const refs = await this.parseHtml(filePath, includeRemote, verbose);
        references.push(...refs);
      }
    }

    logger.success(`解析完成，共发现 ${references.length} 个字体引用`);
    return references;
  }

  private getSourceType(ext: string): ReferenceSource {
    switch (ext) {
      case 'css':
        return 'css';
      case 'scss':
      case 'sass':
        return 'scss';
      case 'html':
      case 'htm':
        return 'html';
      default:
        return 'inline';
    }
  }

  private async parseStylesheet(
    filePath: string,
    source: ReferenceSource,
    includeRemote: boolean,
    verbose: boolean
  ): Promise<FontReference[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.extractFontFace(content, filePath, source, includeRemote, verbose);
    } catch (error) {
      logger.warn(`解析样式表失败: ${filePath}`);
      return [];
    }
  }

  private async parseHtml(
    filePath: string,
    includeRemote: boolean,
    verbose: boolean
  ): Promise<FontReference[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const references: FontReference[] = [];

      const styleMatches = content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      for (const match of styleMatches) {
        const refs = this.extractFontFace(
          match[1],
          filePath,
          'inline',
          includeRemote,
          verbose
        );
        references.push(...refs);
      }

      const linkMatches = content.matchAll(
        /<link[^>]*href=["']([^"']*\.css[^"']*)["'][^>]*>/gi
      );
      for (const match of linkMatches) {
        const href = match[1];
        if (this.isRemoteUrl(href) && includeRemote) {
          references.push({
            id: crypto.createHash('md5').update(href).digest('hex'),
            source: 'html',
            sourcePath: filePath,
            familyName: `Remote CSS: ${new URL(href).hostname}`,
            urls: [href],
            formats: [],
            isRemote: true,
          });
        }
      }

      return references;
    } catch (error) {
      logger.warn(`解析 HTML 失败: ${filePath}`);
      return [];
    }
  }

  private extractFontFace(
    content: string,
    filePath: string,
    source: ReferenceSource,
    includeRemote: boolean,
    verbose: boolean
  ): FontReference[] {
    const references: FontReference[] = [];

    try {
      const ast = csstree.parse(content, {
        onParseError: () => {},
      });

      csstree.walk(ast, {
        enter: (node: csstree.CssNode) => {
          if (node.type === 'Atrule' && node.name === 'font-face') {
            const ref = this.parseFontFaceRule(node, filePath, source, includeRemote);
            if (ref) {
              references.push(ref);
              logger.debug(
                `发现 @font-face: ${ref.familyName} in ${getRelativePath(
                  this.projectDir,
                  filePath
                )}`,
                verbose
              );
            }
          }
        },
      });
    } catch {
      const fontFaceRegex = /@font-face\s*{[^}]+}/gi;
      let match;
      while ((match = fontFaceRegex.exec(content)) !== null) {
        const ref = this.parseFontFaceText(match[0], filePath, source, includeRemote);
        if (ref) {
          references.push(ref);
        }
      }
    }

    return references;
  }

  private parseFontFaceRule(
    node: csstree.Atrule,
    filePath: string,
    source: ReferenceSource,
    includeRemote: boolean
  ): FontReference | null {
    if (!node.block) return null;

    let familyName = '';
    const urls: string[] = [];
    const formats: FontFormat[] = [];
    let weight: string | undefined;
    let style: string | undefined;

    for (const child of node.block.children) {
      if (child.type === 'Declaration') {
        const property = child.property.toLowerCase();

        if (property === 'font-family') {
          familyName = this.extractFontFamily(child.value);
        } else if (property === 'src') {
          const srcData = this.extractSrc(child.value);
          urls.push(...srcData.urls);
          formats.push(...srcData.formats);
        } else if (property === 'font-weight') {
          weight = csstree.generate(child.value);
        } else if (property === 'font-style') {
          style = csstree.generate(child.value);
        }
      }
    }

    const isRemote = urls.some((url) => this.isRemoteUrl(url));
    if (!includeRemote && isRemote && urls.every((url) => this.isRemoteUrl(url))) {
      return null;
    }

    if (!familyName || urls.length === 0) {
      return null;
    }

    return {
      id: crypto
        .createHash('md5')
        .update(`${filePath}-${familyName}-${urls.join(',')}`)
        .digest('hex'),
      source,
      sourcePath: filePath,
      familyName: familyName.replace(/['"]/g, ''),
      urls,
      formats: [...new Set(formats)],
      isRemote,
      weight,
      style,
      lineNumber: node.loc?.start.line,
    };
  }

  private parseFontFaceText(
    text: string,
    filePath: string,
    source: ReferenceSource,
    includeRemote: boolean
  ): FontReference | null {
    const familyMatch = text.match(/font-family\s*:\s*([^;]+)/i);
    const srcMatch = text.match(/src\s*:\s*([^;]+)/i);

    if (!familyMatch || !srcMatch) return null;

    const familyName = familyMatch[1].trim().replace(/['"]/g, '');
    const urls: string[] = [];
    const formats: FontFormat[] = [];

    const urlMatches = srcMatch[1].matchAll(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi);
    for (const match of urlMatches) {
      urls.push(match[1].trim());
    }

    const formatMatches = srcMatch[1].matchAll(/format\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi);
    for (const match of formatMatches) {
      const fmt = match[1].trim().toLowerCase() as FontFormat;
      if (['woff2', 'woff', 'ttf', 'otf', 'eot', 'svg'].includes(fmt)) {
        formats.push(fmt);
      }
    }

    const isRemote = urls.some((url) => this.isRemoteUrl(url));
    if (!includeRemote && isRemote && urls.every((url) => this.isRemoteUrl(url))) {
      return null;
    }

    if (urls.length === 0) return null;

    return {
      id: crypto
        .createHash('md5')
        .update(`${filePath}-${familyName}-${urls.join(',')}`)
        .digest('hex'),
      source,
      sourcePath: filePath,
      familyName,
      urls,
      formats: [...new Set(formats)],
      isRemote,
    };
  }

  private extractFontFamily(value: csstree.CssNode): string {
    return csstree.generate(value).replace(/['"]/g, '').trim();
  }

  private extractSrc(value: csstree.CssNode): { urls: string[]; formats: FontFormat[] } {
    const urls: string[] = [];
    const formats: FontFormat[] = [];

    csstree.walk(value, {
      enter: (node: csstree.CssNode) => {
        if (node.type === 'Url') {
          urls.push(node.value);
        } else if (node.type === 'Function' && node.name === 'format' && node.children) {
          const firstChild = node.children.first;
          if (firstChild && firstChild.type === 'String') {
            const fmt = firstChild.value.toLowerCase() as FontFormat;
            if (['woff2', 'woff', 'ttf', 'otf', 'eot', 'svg'].includes(fmt)) {
              formats.push(fmt);
            }
          }
        }
      },
    });

    return { urls, formats };
  }

  private isRemoteUrl(url: string): boolean {
    return /^https?:\/\//i.test(url) || url.startsWith('//');
  }

  getRemoteReferences(refs: FontReference[]): FontReference[] {
    return refs.filter((r) => r.isRemote);
  }

  matchReferencesWithFiles(
    references: FontReference[],
    fontFiles: { familyName: string; fileName: string }[]
  ): {
    matched: FontReference[];
    unmatched: FontReference[];
  } {
    const matched: FontReference[] = [];
    const unmatched: FontReference[] = [];

    const familyNames = new Set(fontFiles.map((f) => f.familyName.toLowerCase()));
    const fileNames = new Set(fontFiles.map((f) => f.fileName.toLowerCase()));

    for (const ref of references) {
      const family = ref.familyName.toLowerCase();
      const foundInFamily = familyNames.has(family);
      const foundInUrls = ref.urls.some((url) => {
        const baseName = url.split('/').pop()?.toLowerCase() || '';
        return fileNames.has(baseName) || familyNames.has(baseName.replace(/\.[^.]+$/, ''));
      });

      if (foundInFamily || foundInUrls) {
        matched.push(ref);
      } else {
        unmatched.push(ref);
      }
    }

    return { matched, unmatched };
  }
}
