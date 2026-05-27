import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DataSourceType, UnifiedRecord, BatchInfo } from '../types';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateOf?: string;
  recordHash: string;
  batchHash: string;
}

export class BatchManager {
  private batchStore: Map<string, BatchInfo>;
  private recordHashStore: Map<string, string>;
  private readonly storePath: string;

  constructor() {
    this.batchStore = new Map();
    this.recordHashStore = new Map();
    this.storePath = path.join(process.cwd(), 'data', 'batch-store.json');
    this.loadStore();
  }

  private loadStore(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
        this.batchStore = new Map(data.batches || []);
        this.recordHashStore = new Map(data.recordHashes || []);
      }
    } catch (error) {
      console.warn('加载批次存储失败，使用空存储:', error);
    }
  }

  private saveStore(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify({
        batches: Array.from(this.batchStore.entries()),
        recordHashes: Array.from(this.recordHashStore.entries())
      }, null, 2));
    } catch (error) {
      console.warn('保存批次存储失败:', error);
    }
  }

  generateBatchId(sourceType: DataSourceType): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sourceType.toUpperCase()}_${timestamp}_${random}`;
  }

  calculateRecordHash(record: UnifiedRecord, sourceType: DataSourceType): string {
    const keyFields = this.getKeyFields(record, sourceType);
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(keyFields));
    return hash.digest('hex');
  }

  calculateBatchHash(records: UnifiedRecord[], sourceType: DataSourceType): string {
    const sortedHashes = records
      .map(r => this.calculateRecordHash(r, sourceType))
      .sort()
      .join('|');
    const hash = crypto.createHash('md5');
    hash.update(sortedHashes);
    return hash.digest('hex');
  }

  private getKeyFields(record: UnifiedRecord, sourceType: DataSourceType): any {
    switch (sourceType) {
      case 'alarm':
        const alarm = record as any;
        return {
          poleId: alarm.poleId,
          lampId: alarm.lampId,
          alarmTime: alarm.alarmTime,
          alarmType: alarm.alarmType
        };
      case 'inspection':
        const inspection = record as any;
        return {
          poleId: inspection.poleId,
          lampId: inspection.lampId,
          inspectionTime: inspection.inspectionTime,
          inspector: inspection.inspector
        };
      case 'maintenance':
        const maintenance = record as any;
        return {
          poleId: maintenance.poleId,
          lampId: maintenance.lampId,
          reportTime: maintenance.reportTime,
          repairType: maintenance.repairType,
          reporter: maintenance.reporter
        };
      default:
        return record;
    }
  }

  checkDuplicate(record: UnifiedRecord, sourceType: DataSourceType): DuplicateCheckResult {
    const recordHash = this.calculateRecordHash(record, sourceType);
    const existingBatchId = this.recordHashStore.get(recordHash);
    
    return {
      isDuplicate: !!existingBatchId,
      duplicateOf: existingBatchId,
      recordHash,
      batchHash: ''
    };
  }

  checkBatchDuplicate(records: UnifiedRecord[], sourceType: DataSourceType, fileHash?: string): {
    isDuplicate: boolean;
    duplicateBatchId?: string;
    batchHash: string;
    duplicateRecords: number;
    totalRecords: number;
  } {
    const batchHash = fileHash || this.calculateBatchHash(records, sourceType);
    
    for (const [batchId, info] of this.batchStore) {
      if (info.fileHash === batchHash || info.fileHash === fileHash) {
        return {
          isDuplicate: true,
          duplicateBatchId: batchId,
          batchHash,
          duplicateRecords: info.recordCount,
          totalRecords: records.length
        };
      }
    }

    let duplicateCount = 0;
    for (const record of records) {
      const result = this.checkDuplicate(record, sourceType);
      if (result.isDuplicate) {
        duplicateCount++;
      }
    }

    return {
      isDuplicate: duplicateCount === records.length && records.length > 0,
      batchHash,
      duplicateRecords: duplicateCount,
      totalRecords: records.length
    };
  }

  registerBatch(batchId: string, sourceType: DataSourceType, records: UnifiedRecord[], fileHash: string): void {
    for (const record of records) {
      const recordHash = this.calculateRecordHash(record, sourceType);
      if (!this.recordHashStore.has(recordHash)) {
        this.recordHashStore.set(recordHash, batchId);
      }
    }

    this.batchStore.set(batchId, {
      batchId,
      sourceType,
      recordCount: records.length,
      processedAt: new Date().toISOString(),
      fileHash
    });

    this.saveStore();
  }

  getBatchInfo(batchId: string): BatchInfo | undefined {
    return this.batchStore.get(batchId);
  }

  getAllBatches(): BatchInfo[] {
    return Array.from(this.batchStore.values());
  }

  clearAllBatches(): void {
    this.batchStore.clear();
    this.recordHashStore.clear();
    this.saveStore();
  }

  getRecordOriginalBatch(record: UnifiedRecord, sourceType: DataSourceType): string | undefined {
    const recordHash = this.calculateRecordHash(record, sourceType);
    return this.recordHashStore.get(recordHash);
  }
}

export const batchManager = new BatchManager();
