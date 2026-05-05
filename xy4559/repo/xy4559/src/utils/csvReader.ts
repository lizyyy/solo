import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

export interface CsvRecord = Record<string, string>;

export function detectEncoding(buffer: Buffer): string {
  const detection = jschardet.detect(buffer);
  if (detection.encoding === 'GB2312' || detection.encoding === 'GBK') {
    return 'GBK';
  }
  if (detection.encoding === 'UTF-8' || !detection.encoding) {
    return 'UTF-8';
  }
  return detection.encoding;
}

export function readCsvFile(filePath: string): Promise<CsvRecord[]> {
  return new Promise((resolve, reject) => {
    const results: CsvRecord[] = [];
    const buffer = fs.readFileSync(filePath);
    const encoding = detectEncoding(buffer);
    
    let content: string;
    if (encoding === 'GBK' || encoding === 'GB2312') {
      content = iconv.decode(buffer, 'GBK');
    } else {
      content = buffer.toString('UTF-8');
    }

    const stream = Readable.from(content);
    
    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data: CsvRecord) => {
        const trimmedData: CsvRecord = {};
        for (const [key, value] of Object.entries(data)) {
          trimmedData[key.trim()] = (value as string).trim();
        }
        results.push(trimmedData);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error: Error) => {
        reject(error);
      });
  });
}

export function generateBatchId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `batch-${timestamp}`;
}
