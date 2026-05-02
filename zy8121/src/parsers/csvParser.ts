import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { OrderRecord } from '../types';

export interface CsvParseOptions {
  delimiter?: string;
  encoding?: BufferEncoding;
  hasHeader?: boolean;
}

const DEFAULT_OPTIONS: CsvParseOptions = {
  delimiter: ',',
  encoding: 'utf-8',
  hasHeader: true,
};

export function parseOrderCsv(
  filePath: string,
  options: CsvParseOptions = DEFAULT_OPTIONS
): OrderRecord[] {
  const content = fs.readFileSync(filePath, options.encoding);
  
  const records = parse(content, {
    delimiter: options.delimiter,
    columns: options.hasHeader,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record: Record<string, string>) => ({
    orderId: record.orderId || record['订单号'] || record.id || '',
    productName: record.productName || record['产品名称'] || record.product || '',
    customer: record.customer || record['客户'] || '',
    dueDate: record.dueDate || record['交期'] || record.date || '',
    material: record.material || record['材质'] || '',
    quantity: parseInt(record.quantity || record['数量'] || '0', 10),
    notes: record.notes || record['备注'] || undefined,
  }));
}

export function parseCsvFile<T extends Record<string, unknown>>(
  filePath: string,
  options: CsvParseOptions = DEFAULT_OPTIONS
): T[] {
  const content = fs.readFileSync(filePath, options.encoding);
  
  return parse(content, {
    delimiter: options.delimiter,
    columns: options.hasHeader,
    skip_empty_lines: true,
    trim: true,
  });
}
