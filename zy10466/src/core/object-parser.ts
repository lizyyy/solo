import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as dayjs from 'dayjs';
import { ObjectWithSource, BadRow } from '../types';

export class ObjectParser {
  private objects: ObjectWithSource[] = [];
  private badRows: BadRow[] = [];

  parseDirectory(inputPath: string): { objects: ObjectWithSource[]; badRows: BadRow[] } {
    this.objects = [];
    this.badRows = [];

    if (!fs.existsSync(inputPath)) {
      throw new Error(`输入路径不存在: ${inputPath}`);
    }

    const stats = fs.statSync(inputPath);
    
    if (stats.isFile()) {
      this.parseFile(inputPath);
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(inputPath)
        .filter(f => f.toLowerCase().endsWith('.csv'))
        .map(f => path.join(inputPath, f));
      
      if (files.length === 0) {
        throw new Error(`目录中未找到 CSV 文件: ${inputPath}`);
      }

      for (const file of files) {
        this.parseFile(file);
      }
    }

    return { objects: this.objects, badRows: this.badRows };
  }

  private parseFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length === 0) {
      return;
    }

    let headers: string[] = [];
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const rawLine = lines[lineNum].trim();
      
      if (!rawLine) {
        continue;
      }

      try {
        const records = parse(rawLine, {
          skip_empty_lines: true,
          trim: true,
        });

        if (lineNum === 0) {
          headers = records[0].map((h: string) => h.toLowerCase().trim());
          continue;
        }

        const row = records[0];
        const object = this.parseRow(row, headers, filePath, lineNum + 1, rawLine);
        this.objects.push(object);
      } catch (error) {
        this.badRows.push({
          file: filePath,
          line: lineNum + 1,
          raw: rawLine,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private parseRow(
    row: string[],
    headers: string[],
    file: string,
    line: number,
    raw: string
  ): ObjectWithSource {
    const getValue = (key: string): string => {
      const index = headers.indexOf(key);
      if (index === -1 || index >= row.length) {
        return '';
      }
      return row[index]?.trim() || '';
    };

    const key = getValue('key') || getValue('objectkey') || getValue('name');
    if (!key) {
      throw new Error('缺少必填字段: key');
    }

    const sizeStr = getValue('size') || getValue('sizeinbytes');
    const size = sizeStr ? parseInt(sizeStr, 10) : 0;
    if (isNaN(size)) {
      throw new Error(`无效的大小值: ${sizeStr}`);
    }

    const lastModifiedStr = getValue('lastmodified') || getValue('modified');
    if (!lastModifiedStr) {
      throw new Error('缺少必填字段: lastModified');
    }
    const lastModified = dayjs(lastModifiedStr).toDate();
    if (isNaN(lastModified.getTime())) {
      throw new Error(`无效的日期格式: ${lastModifiedStr}`);
    }

    const isLatestStr = getValue('islatest') || getValue('is_latest');
    const isLatest = isLatestStr ? isLatestStr.toLowerCase() === 'true' : true;

    const versionId = getValue('versionid') || undefined;

    const storageClass = getValue('storageclass') || getValue('storage_class') || 'STANDARD';

    const isDeleteMarkerStr = getValue('isdeletemarker') || getValue('is_delete_marker');
    const isDeleteMarker = isDeleteMarkerStr ? isDeleteMarkerStr.toLowerCase() === 'true' : false;

    const tags = this.parseTags(getValue('tags'));

    return {
      key,
      size,
      lastModified,
      isLatest,
      versionId,
      tags,
      storageClass,
      isDeleteMarker,
      source: { file, line, raw },
    };
  }

  private parseTags(tagsStr: string): Array<{ key: string; value: string }> {
    if (!tagsStr) {
      return [];
    }

    try {
      if (tagsStr.startsWith('{') || tagsStr.startsWith('[')) {
        const parsed = JSON.parse(tagsStr);
        if (Array.isArray(parsed)) {
          return parsed.map((t: any) => ({
            key: t.key || t.Key || '',
            value: t.value || t.Value || '',
          }));
        } else {
          return Object.entries(parsed).map(([key, value]) => ({
            key,
            value: String(value),
          }));
        }
      }

      return tagsStr.split(';').filter(Boolean).map(pair => {
        const [key, value] = pair.split('=');
        return { key: key?.trim() || '', value: value?.trim() || '' };
      }).filter(t => t.key);
    } catch {
      return [];
    }
  }

  getObjects(): ObjectWithSource[] {
    return this.objects;
  }

  getBadRows(): BadRow[] {
    return this.badRows;
  }
}
