import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import csvParser from 'csv-parser';
import xlsx from 'xlsx';
import { DataSourceType } from '../models/types';

export function calculateFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

export function directoryExists(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

export function detectFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

export function detectSourceType(fileName: string): DataSourceType {
  const lowerName = fileName.toLowerCase();
  if (lowerName.includes('order') || lowerName.includes('订货') || lowerName.includes('订单')) {
    return DataSourceType.ORDER;
  }
  if (lowerName.includes('loss') || lowerName.includes('损耗') || lowerName.includes('waste')) {
    return DataSourceType.LOSS;
  }
  if (lowerName.includes('price') || lowerName.includes('价格') || lowerName.includes('总部')) {
    return DataSourceType.PRICE;
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].some(ext => lowerName.endsWith(ext))) {
    return DataSourceType.PHOTO;
  }
  throw new Error(`无法识别数据源类型: ${fileName}`);
}

export interface ParseResult {
  headers: string[];
  rows: Record<string, any>[];
}

export async function parseCsvFile(filePath: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, any>[] = [];
    let headers: string[] = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('headers', (h: string[]) => {
        headers = h;
      })
      .on('data', (row: Record<string, any>) => {
        rows.push(row);
      })
      .on('end', () => {
        resolve({ headers, rows });
      })
      .on('error', reject);
  });
}

export function parseExcelFile(filePath: string): ParseResult {
  const workbook = xlsx.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

  if (data.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = data[0].map(h => String(h || ''));
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < data.length; i++) {
    const row: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }

  return { headers, rows };
}

export async function parseDataFile(filePath: string): Promise<ParseResult> {
  const fileType = detectFileType(filePath);

  switch (fileType) {
    case 'csv':
      return parseCsvFile(filePath);
    case 'xls':
    case 'xlsx':
      return parseExcelFile(filePath);
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(amount);
}
