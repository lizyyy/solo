import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { FileConfig } from '../types';

export interface FileReadResult {
  headers: string[];
  records: any[];
  totalCount: number;
}

export class FileReader {
  static read(fileConfig: FileConfig): FileReadResult {
    const filePath = fileConfig.path;
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = fileConfig.type || (ext === '.json' ? 'json' : 'csv');

    if (type === 'json') {
      return this.readJson(filePath, fileConfig);
    } else {
      return this.readCsv(filePath);
    }
  }

  private static readCsv(filePath: string): FileReadResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      if (records.length === 0) {
        return {
          headers: [],
          records: [],
          totalCount: 0,
        };
      }

      const headers = Object.keys(records[0]);
      
      return {
        headers,
        records,
        totalCount: records.length,
      };
    } catch (e) {
      throw new Error(`CSV解析失败: ${(e as Error).message}`);
    }
  }

  private static readJson(filePath: string, fileConfig: FileConfig): FileReadResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let data: any;
    try {
      data = JSON.parse(content);
    } catch (e) {
      throw new Error(`JSON解析失败: ${(e as Error).message}`);
    }

    if (fileConfig.jsonPath) {
      data = this.navigateJsonPath(data, fileConfig.jsonPath);
    }

    if (!Array.isArray(data)) {
      if (typeof data === 'object' && data !== null) {
        data = [data];
      } else {
        throw new Error('JSON文件根节点不是数组且无法转换为数组');
      }
    }

    if (data.length === 0) {
      return {
        headers: [],
        records: [],
        totalCount: 0,
      };
    }

    const headers = this.extractHeaders(data);
    
    const normalizedRecords = data.map((record: any) => 
      this.flattenRecord(record)
    );

    return {
      headers,
      records: normalizedRecords,
      totalCount: data.length,
    };
  }

  private static navigateJsonPath(data: any, jsonPath: string): any {
    const parts = jsonPath.split('.').filter(p => p);
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        current = current[key];
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  private static extractHeaders(records: any[]): string[] {
    const headers = new Set<string>();
    
    for (const record of records) {
      if (typeof record === 'object' && record !== null) {
        const flat = this.flattenRecord(record);
        for (const key of Object.keys(flat)) {
          headers.add(key);
        }
      }
    }

    return Array.from(headers);
  }

  private static flattenRecord(obj: any, prefix: string = ''): any {
    const result: any = {};

    if (obj === null || obj === undefined) {
      return result;
    }

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nested = this.flattenRecord(value, newKey);
        Object.assign(result, nested);
      } else if (Array.isArray(value)) {
        result[newKey] = JSON.stringify(value);
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  static getFileInfo(filePath: string): { exists: boolean; size: number; lastModified: Date } | null {
    try {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }
}
