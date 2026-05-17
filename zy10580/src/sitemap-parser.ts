import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { SitemapEntry, ParseError } from './types';

export class SitemapParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      trimValues: true,
    });
  }

  async parse(filePath: string): Promise<{ entries: SitemapEntry[]; errors: ParseError[] }> {
    const entries: SitemapEntry[] = [];
    const errors: ParseError[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const result = this.parseContent(content, filePath, errors);
      entries.push(...result.entries);
      errors.push(...result.errors);
    } catch (error) {
      errors.push({
        sourceFile: filePath,
        error: `无法读取文件: ${(error as Error).message}`,
      });
    }

    return { entries, errors };
  }

  async parseDirectory(dirPath: string): Promise<{ entries: SitemapEntry[]; errors: ParseError[] }> {
    const allEntries: SitemapEntry[] = [];
    const allErrors: ParseError[] = [];

    const files = await this.findSitemapFiles(dirPath);
    
    for (const file of files) {
      const result = await this.parse(file);
      allEntries.push(...result.entries);
      allErrors.push(...result.errors);
    }

    return { entries: allEntries, errors: allErrors };
  }

  private async findSitemapFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        const subFiles = await this.findSitemapFiles(fullPath);
        files.push(...subFiles);
      } else if (item.isFile() && item.name.endsWith('.xml')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private parseContent(
    content: string,
    sourceFile: string,
    errors: ParseError[]
  ): { entries: SitemapEntry[]; errors: ParseError[] } {
    const entries: SitemapEntry[] = [];
    const lines = content.split('\n');

    try {
      const parsed = this.parser.parse(content);

      if (parsed.urlset?.url) {
        const urls = Array.isArray(parsed.urlset.url) 
          ? parsed.urlset.url 
          : [parsed.urlset.url];

        for (let i = 0; i < urls.length; i++) {
          const urlEntry = urls[i];
          const url = urlEntry.loc?.trim();

          if (!url) {
            errors.push({
              sourceFile,
              lineNumber: this.findLineNumber(lines, '<loc>', i),
              error: 'URL (loc标签) 为空',
              rawContent: JSON.stringify(urlEntry),
            });
            continue;
          }

          entries.push({
            url,
            lastmod: urlEntry.lastmod?.trim(),
            changefreq: urlEntry.changefreq?.trim(),
            priority: urlEntry.priority?.trim(),
            sourceFile,
            lineNumber: this.findLineNumber(lines, url, i),
          });
        }
      }

      if (parsed.sitemapindex?.sitemap) {
        errors.push({
          sourceFile,
          error: '检测到嵌套sitemap索引，请确保包含所有子sitemap文件',
        });
      }

    } catch (error) {
      errors.push({
        sourceFile,
        error: `XML解析失败: ${(error as Error).message}`,
        rawContent: content.substring(0, 500),
      });
    }

    return { entries, errors };
  }

  private findLineNumber(lines: string[], searchString: string, occurrence: number): number {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchString)) {
        if (count === occurrence) {
          return i + 1;
        }
        count++;
      }
    }
    return -1;
  }
}
