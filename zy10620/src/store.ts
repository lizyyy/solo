import { v4 as uuidv4 } from 'uuid';
import { Lease, HistoryRecord, LeaseRemark, RenewalConflict, ImportBadRow } from './types';

export class InMemoryStore {
  private leases: Map<string, Lease> = new Map();
  private history: Map<string, HistoryRecord[]> = new Map();

  createLease(data: Partial<Lease>): Lease {
    const now = new Date().toISOString();
    const lease: Lease = {
      id: data.id || uuidv4(),
      leaseNo: data.leaseNo || `L${Date.now()}`,
      customer: data.customer || { id: '', name: '', phone: '', email: '' },
      asset: data.asset || { id: '', name: '', assetNo: '', type: '' },
      startDate: data.startDate || now,
      endDate: data.endDate || now,
      price: data.price || 0,
      status: data.status || 'leasing',
      paymentStatus: data.paymentStatus || 'paid',
      renewalRule: data.renewalRule || {
        id: uuidv4(),
        name: '默认续租规则',
        autoRenewalDays: 30,
        newLeaseTerm: 12,
        priceAdjustment: 0,
        isActive: true
      },
      conflicts: data.conflicts || [],
      renewalRecords: data.renewalRecords || [],
      remarks: data.remarks || [],
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy || 'system',
      importBadRows: data.importBadRows || []
    };
    this.leases.set(lease.id, lease);
    this.history.set(lease.id, []);
    return lease;
  }

  getLease(id: string): Lease | undefined {
    return this.leases.get(id);
  }

  listLeases(): Lease[] {
    return Array.from(this.leases.values());
  }

  updateLease(id: string, updates: Partial<Lease>): Lease | undefined {
    const lease = this.leases.get(id);
    if (!lease) return undefined;
    const updated = { ...lease, ...updates, updatedAt: new Date().toISOString() };
    this.leases.set(id, updated);
    return updated;
  }

  deleteLease(id: string): boolean {
    return this.leases.delete(id);
  }

  addConflict(leaseId: string, conflict: Omit<RenewalConflict, 'id'>): RenewalConflict | undefined {
    const lease = this.leases.get(leaseId);
    if (!lease) return undefined;
    const newConflict: RenewalConflict = {
      id: uuidv4(),
      ...conflict
    };
    const updatedConflicts = [...lease.conflicts, newConflict];
    this.leases.set(leaseId, { ...lease, conflicts: updatedConflicts, updatedAt: new Date().toISOString() });
    return newConflict;
  }

  updateConflict(leaseId: string, conflictId: string, updates: Partial<RenewalConflict>): RenewalConflict | undefined {
    const lease = this.leases.get(leaseId);
    if (!lease) return undefined;
    const updatedConflicts = lease.conflicts.map(c =>
      c.id === conflictId ? { ...c, ...updates } : c
    );
    const updatedConflict = updatedConflicts.find(c => c.id === conflictId);
    this.leases.set(leaseId, { ...lease, conflicts: updatedConflicts, updatedAt: new Date().toISOString() });
    return updatedConflict;
  }

  addRemark(leaseId: string, remark: Omit<LeaseRemark, 'id' | 'createdAt'>): LeaseRemark | undefined {
    const lease = this.leases.get(leaseId);
    if (!lease) return undefined;
    const newRemark: LeaseRemark = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...remark
    };
    const updatedRemarks = [...lease.remarks, newRemark];
    this.leases.set(leaseId, { ...lease, remarks: updatedRemarks, updatedAt: new Date().toISOString() });
    return newRemark;
  }

  addHistory(leaseId: string, record: Omit<HistoryRecord, 'id' | 'leaseId' | 'timestamp'>): HistoryRecord {
    const historyRecord: HistoryRecord = {
      id: uuidv4(),
      leaseId,
      timestamp: new Date().toISOString(),
      ...record
    };
    const records = this.history.get(leaseId) || [];
    records.push(historyRecord);
    this.history.set(leaseId, records);
    return historyRecord;
  }

  getHistory(leaseId: string): HistoryRecord[] {
    return this.history.get(leaseId) || [];
  }

  setImportBadRows(leaseId: string, badRows: ImportBadRow[]): Lease | undefined {
    const lease = this.leases.get(leaseId);
    if (!lease) return undefined;
    const updated = { ...lease, importBadRows: badRows, updatedAt: new Date().toISOString() };
    this.leases.set(leaseId, updated);
    return updated;
  }

  clearAll(): void {
    this.leases.clear();
    this.history.clear();
  }
}

export const store = new InMemoryStore();
