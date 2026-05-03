import * as fs from 'fs';
import { CdnAccessEntry } from '../types';

export class JsonlParser {
  parseCdnAccess(content: string): CdnAccessEntry[] {
    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    return lines.map((line) => {
      const obj = JSON.parse(line);
      return {
        uri: obj.uri || obj.URL || obj.url || '',
        statusCode: obj.statusCode || obj.status_code || obj.httpStatusCode || 0,
        responseTimeMs: obj.responseTimeMs || obj.response_time_ms || obj.timeMs || obj.time_ms || 0,
        timestamp: obj.timestamp || obj.time || obj.date ? new Date(obj.timestamp || obj.time || obj.date) : new Date(),
        error: obj.error || obj.errorMessage || undefined,
        byteSize: obj.byteSize || obj.size || obj.bytes || undefined,
      };
    });
  }

  async parseCdnAccessFile(filePath: string): Promise<CdnAccessEntry[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parseCdnAccess(content);
  }
}

export default JsonlParser;
