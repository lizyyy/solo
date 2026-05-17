import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { DictField, DictSource, ParseError } from './types';

export class DictionaryParser {
  private parseErrors: ParseError[] = [];

  parse(filePath: string, systemName: string): DictSource {
    this.parseErrors = [];
    const ext = path.extname(filePath).toLowerCase();
    
    let fields: Map<string, DictField>;
    
    if (ext === '.csv') {
      fields = this.parseCsv(filePath);
    } else if (ext === '.json') {
      fields = this.parseJson(filePath);
    } else {
      throw new Error(`不支持的文件格式: ${ext}，仅支持 .csv 和 .json`);
    }

    return {
      systemName,
      filePath,
      fields,
      errors: [...this.parseErrors]
    };
  }

  private parseCsv(filePath: string): Map<string, DictField> {
    const fields = new Map<string, DictField>();
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length === 0) {
      return fields;
    }

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    });

    const headers = Object.keys(records[0] || {});
    const fieldNameIdx = this.findColumn(headers, '字段名', 'fieldName', 'name', 'field');
    const typeIdx = this.findColumn(headers, '类型', 'type', 'dataType');
    const enumIdx = this.findColumn(headers, '枚举值', 'enum', 'enumValues', 'options');
    const descIdx = this.findColumn(headers, '业务说明', '说明', 'description', 'desc', 'comment');

    records.forEach((record: any, index: number) => {
      const lineNumber = index + 2;
      
      try {
        const fieldName = record[fieldNameIdx]?.toString().trim();
        if (!fieldName) {
          this.addParseError(filePath, lineNumber, JSON.stringify(record), '字段名为空');
          return;
        }

        const type = (record[typeIdx] || 'string').toString().trim();
        const enumStr = (record[enumIdx] || '').toString().trim();
        const description = (record[descIdx] || '').toString().trim();

        const enumValues = enumStr
          ? enumStr.split(/[,，;；]/).map((v: string) => v.trim()).filter(Boolean)
          : [];

        fields.set(fieldName, {
          fieldName,
          type,
          enumValues,
          description
        });
      } catch (e) {
        this.addParseError(
          filePath,
          lineNumber,
          JSON.stringify(record),
          `解析失败: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    });

    return fields;
  }

  private parseJson(filePath: string): Map<string, DictField> {
    const fields = new Map<string, DictField>();
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let data: any;
    try {
      data = JSON.parse(content);
    } catch (e) {
      this.addParseError(filePath, 0, content.substring(0, 200), `JSON解析失败: ${e instanceof Error ? e.message : String(e)}`);
      return fields;
    }

    const fieldList = Array.isArray(data) ? data : (data.fields || data);

    fieldList.forEach((item: any, index: number) => {
      const lineNumber = index + 1;
      
      try {
        const fieldName = item.fieldName || item.name || item.字段名;
        if (!fieldName) {
          this.addParseError(filePath, lineNumber, JSON.stringify(item), '字段名为空');
          return;
        }

        const type = item.type || item.类型 || 'string';
        const enumValues = item.enumValues || item.enum || item.枚举值 || [];
        const description = item.description || item.desc || item.业务说明 || item.说明 || '';

        fields.set(fieldName, {
          fieldName,
          type,
          enumValues: Array.isArray(enumValues) ? enumValues : [],
          description
        });
      } catch (e) {
        this.addParseError(
          filePath,
          lineNumber,
          JSON.stringify(item),
          `解析失败: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    });

    return fields;
  }

  private findColumn(headers: string[], ...candidates: string[]): string {
    for (const candidate of candidates) {
      const found = headers.find(h => 
        h.toLowerCase() === candidate.toLowerCase());
      if (found) return found;
    }
    return candidates[0];
  }

  private addParseError(filePath: string, lineNumber: number, rawContent: string, reason: string): void {
    this.parseErrors.push({
      filePath,
      lineNumber,
      rawContent,
      reason
    });
  }

  getErrors(): ParseError[] {
    return [...this.parseErrors];
  }
}
