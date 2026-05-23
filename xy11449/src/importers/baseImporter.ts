import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { DataSource, SourceEvidence, ImportResult, ImportError } from '../models/types';
import { generateId, generateChecksum } from '../utils/crypto';
import { store } from '../store/fileStore';

export abstract class BaseImporter {
  protected abstract sourceType: DataSource;
  protected abstract requiredFields: string[];
  protected abstract parseRow(row: Record<string, any>, rowNum: number): Promise<Record<string, any>>;
  protected abstract getFactKey(parsed: Record<string, any>): string;
  protected abstract createOrUpdateRecord(parsed: Record<string, any>, evidenceId: string, existingId?: string): Promise<string>;

  async importFile(filePath: string, operator: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      errors: [],
      recordIds: []
    };

    const rows = await this.readFile(filePath);
    result.total = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        this.validateRow(row, rowNum, filePath);
        
        const parsed = await this.parseRow(row, rowNum);
        const checksum = generateChecksum({ filePath, rowNum, row });
        
        const existingEvidence = store.findEvidenceByChecksum(checksum);
        if (existingEvidence) {
          result.skipped++;
          continue;
        }

        const evidence: SourceEvidence = {
          id: generateId(),
          sourceType: this.sourceType,
          sourceFile: path.basename(filePath),
          sourceRow: rowNum,
          rawData: { ...row },
          parsedData: parsed,
          importedAt: new Date().toISOString(),
          importedBy: operator,
          checksum
        };

        store.saveEvidence(evidence);

        const factKey = this.getFactKey(parsed);
        const existingRecord = store.findRecordByFactKey(factKey);
        const recordId = await this.createOrUpdateRecord(parsed, evidence.id, existingRecord?.id);
        
        result.recordIds.push(recordId);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          sourceFile: path.basename(filePath),
          error: error instanceof Error ? error.message : String(error),
          rawData: row
        });
      }
    }

    return result;
  }

  private async readFile(filePath: string): Promise<Record<string, any>[]> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      return this.readCsv(filePath);
    } else if (ext === '.json') {
      return this.readJson(filePath);
    }
    
    throw new Error(`不支持的文件格式: ${ext}`);
  }

  private readCsv(filePath: string): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: Record<string, any>) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  private readJson(filePath: string): Promise<Record<string, any>[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Promise.resolve(Array.isArray(data) ? data : [data]);
  }

  private validateRow(row: Record<string, any>, rowNum: number, filePath: string): void {
    const missingFields = this.requiredFields.filter(field => {
      const value = row[field];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }
  }

  async importData(data: Record<string, any>[], sourceName: string, operator: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      total: data.length,
      errors: [],
      recordIds: []
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;

      try {
        this.validateRow(row, rowNum, sourceName);
        
        const parsed = await this.parseRow(row, rowNum);
        const checksum = generateChecksum({ sourceName, rowNum, row });
        
        const existingEvidence = store.findEvidenceByChecksum(checksum);
        if (existingEvidence) {
          result.skipped++;
          continue;
        }

        const evidence: SourceEvidence = {
          id: generateId(),
          sourceType: this.sourceType,
          sourceFile: sourceName,
          sourceRow: rowNum,
          rawData: { ...row },
          parsedData: parsed,
          importedAt: new Date().toISOString(),
          importedBy: operator,
          checksum
        };

        store.saveEvidence(evidence);

        const factKey = this.getFactKey(parsed);
        const existingRecord = store.findRecordByFactKey(factKey);
        const recordId = await this.createOrUpdateRecord(parsed, evidence.id, existingRecord?.id);
        
        result.recordIds.push(recordId);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          sourceFile: sourceName,
          error: error instanceof Error ? error.message : String(error),
          rawData: row
        });
      }
    }

    return result;
  }
}
