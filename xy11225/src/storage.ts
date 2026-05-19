import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageData, FaultRecord, BatchOperationResult, FilterOptions } from './types';

const STORAGE_DIR = path.join(process.cwd(), '.bso-storage');
const DATA_FILE = path.join(STORAGE_DIR, 'data.json');

export class Storage {
  private data: StorageData;

  constructor() {
    this.ensureStorageExists();
    this.data = this.loadData();
  }

  private ensureStorageExists(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  private loadData(): StorageData {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.warn('存储文件损坏，重新初始化');
      }
    }
    return {
      records: [],
      batches: [],
      cabinets: {}
    };
  }

  private saveData(): void {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  generateId(): string {
    return uuidv4();
  }

  addRecord(record: Omit<FaultRecord, 'id' | 'createdAt' | 'updatedAt'>): FaultRecord {
    const now = new Date().toISOString();
    const newRecord: FaultRecord = {
      ...record,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.data.records.push(newRecord);
    this.saveData();
    return newRecord;
  }

  updateRecord(id: string, updates: Partial<FaultRecord>): FaultRecord | null {
    const index = this.data.records.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    this.data.records[index] = {
      ...this.data.records[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.data.records[index];
  }

  getRecord(id: string): FaultRecord | undefined {
    return this.data.records.find(r => r.id === id);
  }

  getRecords(filter?: FilterOptions): FaultRecord[] {
    let records = [...this.data.records];
    
    if (filter) {
      if (filter.handler) {
        records = records.filter(r => r.handler === filter.handler);
      }
      if (filter.cabinetId) {
        records = records.filter(r => r.cabinetId === filter.cabinetId);
      }
      if (filter.status) {
        records = records.filter(r => r.status === filter.status);
      }
      if (filter.faultType) {
        records = records.filter(r => r.faultType === filter.faultType);
      }
      if (filter.startDate) {
        records = records.filter(r => r.createdAt >= filter.startDate!);
      }
      if (filter.endDate) {
        records = records.filter(r => r.createdAt <= filter.endDate!);
      }
    }
    
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getRecordsByCabinet(cabinetId: string): FaultRecord[] {
    return this.data.records.filter(r => r.cabinetId === cabinetId);
  }

  deleteRecord(id: string): boolean {
    const index = this.data.records.findIndex(r => r.id === id);
    if (index === -1) return false;
    this.data.records.splice(index, 1);
    this.saveData();
    return true;
  }

  setCabinetOffline(cabinetId: string, isOffline: boolean): void {
    if (!this.data.cabinets[cabinetId]) {
      this.data.cabinets[cabinetId] = { isOffline: false };
    }
    this.data.cabinets[cabinetId].isOffline = isOffline;
    this.data.cabinets[cabinetId].lastMaintenanceAt = new Date().toISOString();
    this.saveData();
  }

  isCabinetOffline(cabinetId: string): boolean {
    return this.data.cabinets[cabinetId]?.isOffline || false;
  }

  addBatchResult(batch: Omit<BatchOperationResult, 'batchId' | 'createdAt'>): BatchOperationResult {
    const newBatch: BatchOperationResult = {
      ...batch,
      batchId: this.generateId(),
      createdAt: new Date().toISOString()
    };
    this.data.batches.push(newBatch);
    this.saveData();
    return newBatch;
  }

  getBatchResult(batchId: string): BatchOperationResult | undefined {
    return this.data.batches.find(b => b.batchId === batchId);
  }

  getAllBatches(): BatchOperationResult[] {
    return [...this.data.batches];
  }

  getStatistics(): {
    totalRecords: number;
    pendingRecords: number;
    resolvedRecords: number;
    offlineCabinets: number;
    totalBatches: number;
  } {
    return {
      totalRecords: this.data.records.length,
      pendingRecords: this.data.records.filter(r => r.status === '待处理').length,
      resolvedRecords: this.data.records.filter(r => r.status === '已解决').length,
      offlineCabinets: Object.values(this.data.cabinets).filter(c => c.isOffline).length,
      totalBatches: this.data.batches.length
    };
  }
}

export const storage = new Storage();
