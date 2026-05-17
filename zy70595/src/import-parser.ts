import * as fs from 'fs';
import { ImportStatement, DirtyLine } from './types';

export class ImportParser {
  parseFile(filePath: string): { imports: ImportStatement[]; dirtyLines: DirtyLine[] } {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseContent(content, filePath);
  }

  parseContent(content: string, sourceFile?: string): { imports: ImportStatement[]; dirtyLines: DirtyLine[] } {
    const lines = content.split('\n');
    const imports: ImportStatement[] = [];
    const dirtyLines: DirtyLine[] = [];
    let inMultilineComment = false;

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const rawLine = lines[i];

      if (this.isBlankOrComment(rawLine, inMultilineComment)) {
        inMultilineComment = this.updateMultilineCommentState(rawLine, inMultilineComment);
        continue;
      }

      inMultilineComment = this.updateMultilineCommentState(rawLine, inMultilineComment);

      const parseResult = this.parseImportLine(rawLine, lineNumber, sourceFile);
      
      if (parseResult.isDirty) {
        dirtyLines.push({
          lineNumber,
          rawLine,
          reason: parseResult.reason,
          category: parseResult.category,
        });
      } else if ('import' in parseResult) {
        imports.push(parseResult.import);
      }
    }

    return { imports, dirtyLines };
  }

  private isBlankOrComment(line: string, inMultilineComment: boolean): boolean {
    const trimmed = line.trim();
    if (inMultilineComment) return true;
    if (trimmed === '') return true;
    if (trimmed.startsWith('//')) return true;
    return false;
  }

  private updateMultilineCommentState(line: string, currentState: boolean): boolean {
    const hasStart = line.includes('/*');
    const hasEnd = line.includes('*/');
    
    if (hasStart && hasEnd) {
      const startIndex = line.indexOf('/*');
      const endIndex = line.indexOf('*/');
      if (startIndex < endIndex) {
        return currentState;
      }
    }
    
    if (hasStart) return true;
    if (hasEnd) return false;
    return currentState;
  }

  private parseImportLine(
    rawLine: string,
    lineNumber: number,
    sourceFile?: string
  ): { isDirty: true; reason: string; category: DirtyLine['category'] } | { isDirty: false; import: ImportStatement } | { isDirty: false } {
    const trimmed = rawLine.trim();

    if (!trimmed.toLowerCase().startsWith('import')) {
      return { isDirty: false };
    }

    try {
      const isTypeImport = trimmed.includes('import type');
      const importPath = this.extractImportPath(trimmed);

      if (!importPath) {
        return {
          isDirty: true,
          reason: 'Could not extract import path from import statement',
          category: 'parse_error',
        };
      }

      return {
        isDirty: false,
        import: {
          lineNumber,
          rawLine,
          importPath,
          isTypeImport,
          sourceFile,
        },
      };
    } catch (error) {
      return {
        isDirty: true,
        reason: error instanceof Error ? error.message : 'Unknown parse error',
        category: 'parse_error',
      };
    }
  }

  private extractImportPath(line: string): string | null {
    const patterns = [
      /from\s+['"]([^'"]+)['"]/,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  parseImportList(content: string): { imports: string[]; dirtyLines: DirtyLine[] } {
    const lines = content.split('\n');
    const imports: string[] = [];
    const dirtyLines: DirtyLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const rawLine = lines[i].trim();

      if (rawLine === '') continue;

      if (this.isValidImportPath(rawLine)) {
        imports.push(rawLine);
      } else {
        dirtyLines.push({
          lineNumber,
          rawLine: lines[i],
          reason: 'Invalid import path format',
          category: 'invalid_format',
        });
      }
    }

    return { imports, dirtyLines };
  }

  private isValidImportPath(path: string): boolean {
    if (path.includes("'") || path.includes('"')) return false;
    if (path.includes(' ')) return false;
    if (path.length === 0) return false;
    return true;
  }
}