import { RedApply, HistoryRecord, OperationSource, RedApplyStatus, ErrorType } from '../types';
import { v4 as uuidv4 } from 'uuid';

class Database {
  private redApplies: Map<string, RedApply> = new Map();
  private historyRecords: Map<string, HistoryRecord> = new Map();

  addRedApply(redApply: Omit<RedApply, 'id' | 'createdAt' | 'updatedAt'>): RedApply {
    const id = uuidv4();
    const now = new Date().toISOString();
    const newApply: RedApply = {
      ...redApply,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.redApplies.set(id, newApply);
    return newApply;
  }

  getRedApply(id: string): RedApply | undefined {
    return this.redApplies.get(id);
  }

  updateRedApply(id: string, updates: Partial<RedApply>): RedApply | undefined {
    const apply = this.redApplies.get(id);
    if (!apply) return undefined;
    
    const updatedApply = { ...apply, ...updates, updatedAt: new Date().toISOString() };
    this.redApplies.set(id, updatedApply);
    return updatedApply;
  }

  listRedApplies(filters?: { status?: RedApplyStatus }): RedApply[] {
    const list = Array.from(this.redApplies.values());
    if (filters?.status) {
      return list.filter(a => a.status === filters.status);
    }
    return list;
  }

  addHistoryRecord(record: Omit<HistoryRecord, 'id' | 'operationTime'>): HistoryRecord {
    const historyRecord: HistoryRecord = {
      ...record,
      id: uuidv4(),
      operationTime: new Date().toISOString()
    };
    this.historyRecords.set(historyRecord.id, historyRecord);
    return historyRecord;
  }

  getHistoryByRedApplyId(redApplyId: string): HistoryRecord[] {
    return Array.from(this.historyRecords.values())
      .filter(r => r.redApplyId === redApplyId)
      .sort((a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime());
  }

  findByInvoiceKey(key: string, value: any): RedApply | undefined {
    return Array.from(this.redApplies.values()).find(a => 
      a.invoice.invoiceCode === value || a.invoice.invoiceNumber === value
    );
  }

  findByOrderNo(orderNo: string): RedApply | undefined {
    return Array.from(this.redApplies.values()).find(a => a.order.orderNo === orderNo);
  }

  clear(): void {
    this.redApplies.clear();
    this.historyRecords.clear();
  }
}

export const db = new Database();
