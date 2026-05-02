import fs from 'fs';
import { parse } from 'csv-parse/sync';

export function parseShotList(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV 文件不存在: ${csvPath}`);
  }
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  return records.map((record, index) => ({
    ...record,
    lineNumber: index + 2
  }));
}