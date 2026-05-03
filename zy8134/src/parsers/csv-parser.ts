import * as fs from 'fs';
import { parse } from 'csv-parse';
import { SegmentManifestEntry } from '../types';

export class CsvParser {
  async parseSegmentsManifest(content: string): Promise<SegmentManifestEntry[]> {
    return new Promise((resolve, reject) => {
      parse(
        content,
        {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        },
        (err, records: Array<Record<string, string>>) => {
          if (err) {
            reject(err);
            return;
          }

          const entries: SegmentManifestEntry[] = records.map((record) => ({
            uri: record.uri || record.URI || '',
            path: record.path || record.PATH || '',
            size: parseInt(record.size || record.SIZE || '0', 10),
            duration: parseFloat(record.duration || record.DURATION || '0'),
            sequenceNumber: parseInt(record.sequenceNumber || record.sequence_number || record.SEQUENCE_NUMBER || '0', 10),
            variant: record.variant || record.VARIANT || '',
            md5: record.md5 || record.MD5 || undefined,
            programDateTime: record.programDateTime || record.program_date_time || record.PROGRAM_DATE_TIME
              ? new Date(record.programDateTime || record.program_date_time || record.PROGRAM_DATE_TIME)
              : undefined,
          }));

          resolve(entries);
        }
      );
    });
  }

  async parseSegmentsManifestFile(filePath: string): Promise<SegmentManifestEntry[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parseSegmentsManifest(content);
  }
}

export default CsvParser;
