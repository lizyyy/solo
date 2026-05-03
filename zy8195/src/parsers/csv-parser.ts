import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import { CertInventoryItem } from '../types';

export class CsvParser {
  async parseCertInventory(filePath: string): Promise<CertInventoryItem[]> {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    return new Promise((resolve, reject) => {
      parse(
        fileContent,
        {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        },
        (err, records) => {
          if (err) {
            reject(new Error(`Failed to parse CSV file: ${err.message}`));
            return;
          }

          const inventory: CertInventoryItem[] = records.map((record: Record<string, string>, index: number) => {
            const serviceName = record['service_name']?.trim() || record['serviceName']?.trim();
            if (!serviceName) {
              throw new Error(`Missing service_name at row ${index + 1}`);
            }

            const certFilePath = record['cert_file_path']?.trim() || record['certFilePath']?.trim();
            if (!certFilePath) {
              throw new Error(`Missing cert_file_path for service ${serviceName}`);
            }

            const sanString = record['expected_sans']?.trim() || record['expectedSANs']?.trim() || '';
            const expectedSANs = sanString
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            return {
              serviceName,
              certFilePath: path.join(path.dirname(filePath), certFilePath),
              keyFilePath: record['key_file_path']?.trim() || record['keyFilePath']?.trim() || '',
              rotationBatch: record['rotation_batch']?.trim() || record['rotationBatch']?.trim() || 'default',
              expectedSANs,
            };
          });

          resolve(inventory);
        }
      );
    });
  }

  async parseIssuesCsv(filePath: string): Promise<Record<string, string>[]> {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    return new Promise((resolve, reject) => {
      parse(
        fileContent,
        {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        },
        (err, records) => {
          if (err) {
            reject(new Error(`Failed to parse issues CSV: ${err.message}`));
            return;
          }
          resolve(records);
        }
      );
    });
  }
}
