import { ArrivalDiffRecord, HistoryRecord, PurchaseOrder, ArrivalStatus } from '../types';

class DataStore {
  private diffRecords: Map<string, ArrivalDiffRecord> = new Map();
  private historyRecords: Map<string, HistoryRecord> = new Map();
  private purchaseOrders: Map<string, PurchaseOrder> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleOrders: PurchaseOrder[] = [
      {
        id: 'PO-001',
        orderNo: 'PO2024001',
        supplierId: 'SUP-001',
        supplierName: '优质供应商A',
        materialId: 'MAT-001',
        materialName: '电子元件X1',
        orderQuantity: 1000,
        unit: '个',
        createdAt: new Date('2024-01-15')
      },
      {
        id: 'PO-002',
        orderNo: 'PO2024002',
        supplierId: 'SUP-002',
        supplierName: '诚信供应商B',
        materialId: 'MAT-002',
        materialName: '精密螺丝M3',
        orderQuantity: 5000,
        unit: '颗',
        createdAt: new Date('2024-01-16')
      }
    ];
    sampleOrders.forEach(po => this.purchaseOrders.set(po.id, po));
  }

  getDiffRecord(id: string): ArrivalDiffRecord | undefined {
    return this.diffRecords.get(id);
  }

  getDiffRecordByOrderNo(orderNo: string): ArrivalDiffRecord | undefined {
    return Array.from(this.diffRecords.values()).find(r => r.orderNo === orderNo);
  }

  getAllDiffRecords(): ArrivalDiffRecord[] {
    return Array.from(this.diffRecords.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  createDiffRecord(record: Omit<ArrivalDiffRecord, 'id' | 'createdAt' | 'updatedAt'>): ArrivalDiffRecord {
    const id = `DIFF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date();
    const newRecord: ArrivalDiffRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.diffRecords.set(id, newRecord);
    return newRecord;
  }

  updateDiffRecord(id: string, updates: Partial<ArrivalDiffRecord>): ArrivalDiffRecord | undefined {
    const record = this.diffRecords.get(id);
    if (!record) return undefined;
    const updatedRecord = { ...record, ...updates, updatedAt: new Date() };
    this.diffRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  getOpenRecordsByOrderNo(orderNo: string): ArrivalDiffRecord[] {
    return Array.from(this.diffRecords.values()).filter(
      r => r.orderNo === orderNo && 
           r.status !== ArrivalStatus.STOCKED && 
           r.status !== ArrivalStatus.CONFIRMED
    );
  }

  getHistoryByRecordId(recordId: string): HistoryRecord[] {
    return Array.from(this.historyRecords.values())
      .filter(h => h.recordId === recordId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  addHistory(record: Omit<HistoryRecord, 'id' | 'createdAt'>): HistoryRecord {
    const id = `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const historyRecord: HistoryRecord = {
      ...record,
      id,
      createdAt: new Date()
    };
    this.historyRecords.set(id, historyRecord);
    return historyRecord;
  }

  getPurchaseOrder(orderNo: string): PurchaseOrder | undefined {
    return Array.from(this.purchaseOrders.values()).find(po => po.orderNo === orderNo);
  }
}

export const dataStore = new DataStore();
