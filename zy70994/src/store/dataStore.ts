import { v4 as uuidv4 } from 'uuid';
import {
  SubsidyRecord,
  SwipeRecord,
  RefundRecord,
  ReconciliationBatch,
  ReconciliationDetail,
  FileInfo
} from '../models/types';

class DataStore {
  private static instance: DataStore;
  
  private subsidyRecords: Map<string, SubsidyRecord> = new Map();
  private swipeRecords: Map<string, SwipeRecord> = new Map();
  private refundRecords: Map<string, RefundRecord> = new Map();
  private batches: Map<string, ReconciliationBatch> = new Map();
  private details: Map<string, ReconciliationDetail> = new Map();
  private batchDetailsMap: Map<string, string[]> = new Map();
  
  private constructor() {}
  
  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }
  
  generateId(): string {
    return uuidv4();
  }
  
  saveSubsidyRecords(records: SubsidyRecord[]): void {
    records.forEach(r => this.subsidyRecords.set(r.id, r));
  }
  
  saveSwipeRecords(records: SwipeRecord[]): void {
    records.forEach(r => this.swipeRecords.set(r.id, r));
  }
  
  saveRefundRecords(records: RefundRecord[]): void {
    records.forEach(r => this.refundRecords.set(r.id, r));
  }
  
  getSubsidyByMonth(month: string): SubsidyRecord[] {
    return Array.from(this.subsidyRecords.values()).filter(
      r => r.effectiveMonth === month && r.status === 'active'
    );
  }
  
  getSwipesByMonth(month: string): SwipeRecord[] {
    return Array.from(this.swipeRecords.values()).filter(
      r => r.swipeTime.toISOString().startsWith(month)
    );
  }
  
  getRefundsByMonth(month: string): RefundRecord[] {
    return Array.from(this.refundRecords.values()).filter(
      r => r.refundDate.toISOString().startsWith(month) && r.status === 'processed'
    );
  }
  
  createBatch(batch: Omit<ReconciliationBatch, 'id'>): ReconciliationBatch {
    const id = this.generateId();
    const newBatch = { ...batch, id };
    this.batches.set(id, newBatch);
    this.batchDetailsMap.set(id, []);
    return newBatch;
  }
  
  updateBatch(id: string, updates: Partial<ReconciliationBatch>): ReconciliationBatch | null {
    const batch = this.batches.get(id);
    if (!batch) return null;
    const updated = { ...batch, ...updates };
    this.batches.set(id, updated);
    return updated;
  }
  
  getBatch(id: string): ReconciliationBatch | null {
    return this.batches.get(id) || null;
  }
  
  getAllBatches(): ReconciliationBatch[] {
    return Array.from(this.batches.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
  
  addDetail(detail: ReconciliationDetail): void {
    this.details.set(detail.id, detail);
    const batchDetails = this.batchDetailsMap.get(detail.batchId) || [];
    batchDetails.push(detail.id);
    this.batchDetailsMap.set(detail.batchId, batchDetails);
  }
  
  updateDetail(id: string, updates: Partial<ReconciliationDetail>): ReconciliationDetail | null {
    const detail = this.details.get(id);
    if (!detail) return null;
    const updated = { ...detail, ...updates };
    this.details.set(id, updated);
    return updated;
  }
  
  getDetail(id: string): ReconciliationDetail | null {
    return this.details.get(id) || null;
  }
  
  getDetailsByBatch(batchId: string): ReconciliationDetail[] {
    const detailIds = this.batchDetailsMap.get(batchId) || [];
    return detailIds.map(id => this.details.get(id)!).filter(Boolean);
  }
  
  getSubsidyRecord(studentId: string, month: string): SubsidyRecord | undefined {
    return Array.from(this.subsidyRecords.values()).find(
      r => r.studentId === studentId && r.effectiveMonth === month
    );
  }
  
  clear(): void {
    this.subsidyRecords.clear();
    this.swipeRecords.clear();
    this.refundRecords.clear();
    this.batches.clear();
    this.details.clear();
    this.batchDetailsMap.clear();
  }
}

export default DataStore.getInstance();
