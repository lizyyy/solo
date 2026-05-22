import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { SourceType } from '../types';

export interface ParsedRow {
  rawLineNumber: number;
  rawContent: string;
  fields: Record<string, string>;
}

export abstract class BaseParser {
  abstract parse(filePath: string): Promise<ParsedRow[]>;

  protected detectSourceType(filePath: string): SourceType {
    const filename = path.basename(filePath).toLowerCase();
    if (filename.includes('报修') || filename.includes('report') || filename.includes('resident')) {
      return 'resident_report';
    }
    if (filename.includes('回执') || filename.includes('receipt') || filename.includes('technician')) {
      return 'technician_receipt';
    }
    if (filename.includes('材料') || filename.includes('material') || filename.includes('usage')) {
      return 'material_usage';
    }
    if (filename.includes('批注') || filename.includes('note') || filename.includes('supervisor')) {
      return 'supervisor_note';
    }
    throw new Error(`无法识别文件类型: ${filename}，请在文件名中包含标识（报修/回执/材料/批注）`);
  }
}

export class CsvParser extends BaseParser {
  async parse(filePath: string): Promise<ParsedRow[]> {
    const results: ParsedRow[] = [];
    let lineNumber = 1;

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', () => {
          lineNumber = 2;
        })
        .on('data', (data) => {
          results.push({
            rawLineNumber: lineNumber++,
            rawContent: JSON.stringify(data),
            fields: data,
          });
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
}

export class ExcelParser extends BaseParser {
  async parse(filePath: string): Promise<ParsedRow[]> {
    const results: ParsedRow[] = [];
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (data.length < 2) {
      return results;
    }

    const headers = data[0].map(h => String(h || ''));

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const fields: Record<string, string> = {};
      headers.forEach((header, idx) => {
        fields[header] = String(row[idx] || '');
      });

      const hasData = Object.values(fields).some(v => v.trim() !== '');
      if (hasData) {
        results.push({
          rawLineNumber: i + 1,
          rawContent: JSON.stringify(fields),
          fields,
        });
      }
    }

    return results;
  }
}

export class TextParser extends BaseParser {
  async parse(filePath: string): Promise<ParsedRow[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const results: ParsedRow[] = [];

    let headers: string[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = line.split(/[\t,，\s]+/);

      if (!headers) {
        headers = fields;
        continue;
      }

      const rowData: Record<string, string> = {};
      headers.forEach((header, idx) => {
        rowData[header] = fields[idx] || '';
      });

      results.push({
        rawLineNumber: i + 1,
        rawContent: line,
        fields: rowData,
      });
    }

    return results;
  }
}

export function getParser(filePath: string): BaseParser {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    return new CsvParser();
  }
  if (['.xlsx', '.xls', '.xlsm'].includes(ext)) {
    return new ExcelParser();
  }
  if (['.txt', '.tsv'].includes(ext)) {
    return new TextParser();
  }
  throw new Error(`不支持的文件格式: ${ext}，支持的格式: .csv, .xlsx, .xls, .txt, .tsv`);
}
