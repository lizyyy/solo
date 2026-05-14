import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RecordingRecord, BatchInfo, QueryOptions, ProcessingStatus, AbnormalType } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');

export class Storage {
  private static ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private static ensureFile(filePath: string, defaultContent: string): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, defaultContent, 'utf8');
    }
  }

  static loadRecords(): RecordingRecord[] {
    this.ensureDataDir();
    this.ensureFile(RECORDS_FILE, '[]');
    const content = fs.readFileSync(RECORDS_FILE, 'utf8');
    return JSON.parse(content);
  }

  static saveRecords(records: RecordingRecord[]): void {
    this.ensureDataDir();
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
  }

  static loadBatches(): BatchInfo[] {
    this.ensureDataDir();
    this.ensureFile(BATCHES_FILE, '[]');
    const content = fs.readFileSync(BATCHES_FILE, 'utf8');
    return JSON.parse(content);
  }

  static saveBatches(batches: BatchInfo[]): void {
    this.ensureDataDir();
    fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2), 'utf8');
  }

  static addRecord(record: Omit<RecordingRecord, 'id' | 'createdAt' | 'updatedAt'>): RecordingRecord {
    const records = this.loadRecords();
    const newRecord: RecordingRecord = {
      ...record,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.push(newRecord);
    this.saveRecords(records);
    this.updateBatchStats(record.batchId);
    return newRecord;
  }

  static updateRecord(id: string, updates: Partial<RecordingRecord>): RecordingRecord | null {
    const records = this.loadRecords();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveRecords(records);
    this.updateBatchStats(records[index].batchId);
    return records[index];
  }

  static getRecordById(id: string): RecordingRecord | undefined {
    return this.loadRecords().find(r => r.id === id);
  }

  static queryRecords(options: QueryOptions): RecordingRecord[] {
    let records = this.loadRecords();

    if (options.batchId) {
      records = records.filter(r => r.batchId === options.batchId);
    }

    if (options.status) {
      records = records.filter(r => r.status === options.status);
    }

    if (options.abnormalType) {
      records = records.filter(r => r.abnormalType === options.abnormalType);
    }

    if (options.startDate) {
      records = records.filter(r => r.createdAt >= options.startDate!);
    }

    if (options.endDate) {
      records = records.filter(r => r.createdAt <= options.endDate!);
    }

    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      records = records.filter(r => 
        r.customerName.toLowerCase().includes(keyword) ||
        r.agentName.toLowerCase().includes(keyword) ||
        r.summary.toLowerCase().includes(keyword) ||
        r.recordingId.toLowerCase().includes(keyword)
      );
    }

    return records;
  }

  static addBatch(batch: Omit<BatchInfo, 'createdAt'>): BatchInfo {
    const batches = this.loadBatches();
    const newBatch: BatchInfo = {
      ...batch,
      createdAt: new Date().toISOString()
    };
    batches.push(newBatch);
    this.saveBatches(batches);
    return newBatch;
  }

  static getBatchById(batchId: string): BatchInfo | undefined {
    return this.loadBatches().find(b => b.batchId === batchId);
  }

  static updateBatchStats(batchId: string): void {
    const records = this.loadRecords().filter(r => r.batchId === batchId);
    const batches = this.loadBatches();
    const batchIndex = batches.findIndex(b => b.batchId === batchId);
    
    if (batchIndex !== -1) {
      batches[batchIndex] = {
        ...batches[batchIndex],
        totalRecords: records.length,
        successCount: records.filter(r => r.status === ProcessingStatus.SUCCESS).length,
        abnormalCount: records.filter(r => r.status === ProcessingStatus.ABNORMAL).length,
        pendingCount: records.filter(r => r.status === ProcessingStatus.PENDING).length,
        correctedCount: records.filter(r => r.status === ProcessingStatus.MANUALLY_CORRECTED).length,
        processedAt: new Date().toISOString()
      };
      this.saveBatches(batches);
    }
  }

  static getAllBatches(): BatchInfo[] {
    return this.loadBatches();
  }

  static manuallyCorrectRecord(
    recordId: string,
    correctedBy: string,
    correctionReason: string,
    updates: Partial<RecordingRecord>
  ): RecordingRecord | null {
    return this.updateRecord(recordId, {
      ...updates,
      status: ProcessingStatus.MANUALLY_CORRECTED,
      correctedBy,
      correctionReason,
      correctionTime: new Date().toISOString()
    });
  }
}
