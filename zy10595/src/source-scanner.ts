import * as fs from 'fs';
import * as path from 'path';
import { EnumDefinition, EnumValue, BadEntry } from './types';

export class SourceScanner {
  private badEntries: BadEntry[] = [];
  private enums: EnumDefinition[] = [];

  scanFiles(filePaths: string[]): { enums: EnumDefinition[]; badEntries: BadEntry[] } {
    this.badEntries = [];
    this.enums = [];

    for (const filePath of filePaths) {
      try {
        if (fs.statSync(filePath).isDirectory()) {
          this.scanDirectory(filePath);
        } else {
          this.scanFile(filePath);
        }
      } catch (e: any) {
        this.addBadEntry(filePath, undefined, undefined, '', `扫描失败: ${e.message}`);
      }
    }

    return { enums: this.enums, badEntries: this.badEntries };
  }

  private scanDirectory(dirPath: string): void {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          this.scanDirectory(fullPath);
        } else if (this.isSourceFile(file)) {
          this.scanFile(fullPath);
        }
      } catch (e: any) {
        this.addBadEntry(fullPath, undefined, undefined, '', `目录扫描失败: ${e.message}`);
      }
    }
  }

  private isSourceFile(fileName: string): boolean {
    return /\.(ts|tsx|js|jsx|java|py|go)$/.test(fileName);
  }

  private scanFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.ts' || ext === '.tsx') {
        this.extractTypeScriptEnums(content, lines, filePath);
        this.extractJavaScriptEnums(content, lines, filePath);
      } else if (ext === '.js' || ext === '.jsx') {
        this.extractJavaScriptEnums(content, lines, filePath);
      } else if (ext === '.py') {
        this.extractPythonEnums(content, lines, filePath);
      } else if (ext === '.java') {
        this.extractJavaEnums(content, lines, filePath);
      } else if (ext === '.go') {
        this.extractGoEnums(content, lines, filePath);
      }

    } catch (e: any) {
      this.addBadEntry(filePath, undefined, undefined, '', `文件读取失败: ${e.message}`);
    }
  }

  private extractTypeScriptEnums(content: string, lines: string[], filePath: string): void {
    const enumRegex = /\benum\s+(\w+)\s*{([^}]*)}/g;
    let match;

    while ((match = enumRegex.exec(content)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      const lineNum = this.getLineNumber(content, match.index);

      const values = this.parseEnumValues(enumBody, lineNum, lines, filePath);
      this.addEnumDefinition(enumName, values, filePath, match[0]);
    }
  }

  private extractJavaScriptEnums(content: string, lines: string[], filePath: string): void {
    const constEnumRegex = /(?:^|\n)\s*const\s+(\w+)\s*=\s*{([^}]*)}/g;
    let match;

    while ((match = constEnumRegex.exec(content)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      
      if (enumBody.includes(':') && this.looksLikeEnum(enumBody)) {
        const lineNum = this.getLineNumber(content, match.index);
        const values = this.parseObjectEnumValues(enumBody, lineNum, lines, filePath);
        if (values.length > 0) {
          this.addEnumDefinition(enumName, values, filePath, match[0]);
        }
      }
    }
  }

  private extractPythonEnums(content: string, lines: string[], filePath: string): void {
    const classEnumRegex = /class\s+(\w+)\s*\(\s*Enum\s*\):\s*\n((?:\s+\w+\s*=.*\n)*)/g;
    let match;

    while ((match = classEnumRegex.exec(content)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      const lineNum = this.getLineNumber(content, match.index);
      const values = this.parsePythonEnumValues(enumBody, lineNum, lines, filePath);
      this.addEnumDefinition(enumName, values, filePath, match[0]);
    }
  }

  private extractJavaEnums(content: string, lines: string[], filePath: string): void {
    const enumRegex = /\benum\s+(\w+)\s*{([^}]*)}/g;
    let match;

    while ((match = enumRegex.exec(content)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      const lineNum = this.getLineNumber(content, match.index);
      const values = this.parseJavaEnumValues(enumBody, lineNum, lines, filePath);
      this.addEnumDefinition(enumName, values, filePath, match[0]);
    }
  }

  private extractGoEnums(content: string, lines: string[], filePath: string): void {
    const constBlockRegex = /const\s*\(\s*\n((?:\s+\w+\s+\w+\s*=.*\n)*)\s*\)/g;
    let match;

    while ((match = constBlockRegex.exec(content)) !== null) {
      const constBody = match[1];
      const lineNum = this.getLineNumber(content, match.index);
      const values = this.parseGoConstValues(constBody, lineNum, lines, filePath);
      
      const typeMatch = constBody.match(/\w+\s+(\w+)\s*=/);
      if (typeMatch && values.length > 0) {
        this.addEnumDefinition(typeMatch[1], values, filePath, match[0]);
      }
    }
  }

  private parseEnumValues(enumBody: string, startLine: number, lines: string[], filePath: string): EnumValue[] {
    const values: EnumValue[] = [];
    const seenKeys = new Set<string>();
    const valueRegex = /(?:^|,|\n)\s*(\w+)(?:\s*=\s*([^,\n]+))?/g;
    let match;

    while ((match = valueRegex.exec(enumBody)) !== null) {
      const key = match[1];
      
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      
      const value = match[2] ? match[2].trim() : key;
      const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index));
      
      values.push({
        value: this.normalizeValue(value),
        source: 'source',
        line: lineNum,
        column: match.index + 1
      });
    }

    return values;
  }

  private parseObjectEnumValues(enumBody: string, startLine: number, lines: string[], filePath: string): EnumValue[] {
    const values: EnumValue[] = [];
    const valueRegex = /(\w+)\s*:\s*([^,\n]+)/g;
    let match;

    while ((match = valueRegex.exec(enumBody)) !== null) {
      const value = match[2].trim();
      const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index));
      
      values.push({
        value: this.normalizeValue(value),
        source: 'source',
        line: lineNum,
        column: match.index + 1
      });
    }

    return values;
  }

  private parsePythonEnumValues(enumBody: string, startLine: number, lines: string[], filePath: string): EnumValue[] {
    const values: EnumValue[] = [];
    const valueRegex = /(\w+)\s*=\s*(.+)/g;
    let match;

    while ((match = valueRegex.exec(enumBody)) !== null) {
      const value = match[2].trim();
      const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index)) + 1;
      
      values.push({
        value: this.normalizeValue(value),
        source: 'source',
        line: lineNum,
        column: match.index + 1
      });
    }

    return values;
  }

  private parseJavaEnumValues(enumBody: string, startLine: number, lines: string[], filePath: string): EnumValue[] {
    const values: EnumValue[] = [];
    const valueRegex = /(\w+)(?:\([^)]*\))?/g;
    let match;

    while ((match = valueRegex.exec(enumBody)) !== null) {
      const value = match[1].trim();
      if (value && !['public', 'private', 'protected', 'static', 'final'].includes(value)) {
        const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index));
        
        values.push({
          value: value,
          source: 'source',
          line: lineNum,
          column: match.index + 1
        });
      }
    }

    return values;
  }

  private parseGoConstValues(enumBody: string, startLine: number, lines: string[], filePath: string): EnumValue[] {
    const values: EnumValue[] = [];
    const valueRegex = /(\w+)\s+\w+\s*=\s*(.+)/g;
    let match;

    while ((match = valueRegex.exec(enumBody)) !== null) {
      const value = match[2].trim();
      const lineNum = startLine + this.countNewLines(enumBody.substring(0, match.index)) + 1;
      
      values.push({
        value: this.normalizeValue(value),
        source: 'source',
        line: lineNum,
        column: match.index + 1
      });
    }

    return values;
  }

  private normalizeValue(value: string): string | number {
    const trimmed = value.trim();
    
    if (/^['"].*['"]$/.test(trimmed)) {
      return trimmed.slice(1, -1);
    }
    
    if (/^-?\d+\.?\d*$/.test(trimmed)) {
      return Number(trimmed);
    }

    return trimmed;
  }

  private looksLikeEnum(body: string): boolean {
    return body.split(',').length >= 2;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private countNewLines(str: string): number {
    return (str.match(/\n/g) || []).length;
  }

  private addEnumDefinition(name: string, values: EnumValue[], filePath: string, rawContent: string): void {
    this.enums.push({
      name,
      values,
      source: 'source',
      filePath,
      rawContent
    });
  }

  private addBadEntry(filePath: string, line: number | undefined, column: number | undefined, rawContent: string, reason: string): void {
    this.badEntries.push({
      filePath,
      line,
      column,
      rawContent,
      reason,
      severity: 'error'
    });
  }
}
