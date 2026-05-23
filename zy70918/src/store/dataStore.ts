import { v4 as uuidv4 } from 'uuid';
import {
  ElderProfile,
  NurseSchedule,
  ServiceOrder,
  ReconciliationRecord,
  ReconciliationBatch,
} from '../types';

class DataStore {
  private static instance: DataStore;
  private elders: Map<string, ElderProfile> = new Map();
  private schedules: Map<string, NurseSchedule[]> = new Map();
  private serviceOrders: Map<string, ServiceOrder> = new Map();
  private reconciliationRecords: Map<string, ReconciliationRecord> = new Map();
  private reconciliationBatches: Map<string, ReconciliationBatch> = new Map();

  private constructor() {}

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  clearAll(): void {
    this.elders.clear();
    this.schedules.clear();
    this.serviceOrders.clear();
    this.reconciliationRecords.clear();
    this.reconciliationBatches.clear();
  }

  saveElder(elder: ElderProfile): void {
    this.elders.set(elder.id, elder);
  }

  saveElders(elders: ElderProfile[]): void {
    elders.forEach(e => this.saveElder(e));
  }

  getElder(id: string): ElderProfile | undefined {
    return this.elders.get(id);
  }

  getAllElders(): ElderProfile[] {
    return Array.from(this.elders.values());
  }

  saveSchedule(nurseId: string, schedule: NurseSchedule): void {
    const existing = this.schedules.get(nurseId) || [];
    const filtered = existing.filter(s => s.date !== schedule.date);
    this.schedules.set(nurseId, [...filtered, schedule]);
  }

  saveSchedules(schedules: NurseSchedule[]): void {
    schedules.forEach(s => this.saveSchedule(s.nurseId, s));
  }

  getSchedulesByNurse(nurseId: string): NurseSchedule[] {
    return this.schedules.get(nurseId) || [];
  }

  getAllSchedules(): NurseSchedule[] {
    return Array.from(this.schedules.values()).flat();
  }

  getSchedulesByDate(date: string): NurseSchedule[] {
    return this.getAllSchedules().filter(s => s.date === date);
  }

  saveServiceOrder(order: ServiceOrder): void {
    this.serviceOrders.set(order.id, order);
  }

  saveServiceOrders(orders: ServiceOrder[]): void {
    orders.forEach(o => this.saveServiceOrder(o));
  }

  getServiceOrder(id: string): ServiceOrder | undefined {
    return this.serviceOrders.get(id);
  }

  getServiceOrdersByDateRange(start: string, end: string): ServiceOrder[] {
    return Array.from(this.serviceOrders.values()).filter(
      o => o.serviceDate >= start && o.serviceDate <= end
    );
  }

  getAllServiceOrders(): ServiceOrder[] {
    return Array.from(this.serviceOrders.values());
  }

  createBatch(
    name: string,
    periodStart: string,
    periodEnd: string,
    createdBy: string
  ): ReconciliationBatch {
    const batch: ReconciliationBatch = {
      id: uuidv4(),
      name,
      periodStart,
      periodEnd,
      totalRecords: 0,
      matchedCount: 0,
      discrepancyCount: 0,
      reviewingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      supplementCount: 0,
      status: 'processing',
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.reconciliationBatches.set(batch.id, batch);
    return batch;
  }

  saveBatch(batch: ReconciliationBatch): void {
    batch.updatedAt = new Date();
    this.reconciliationBatches.set(batch.id, batch);
  }

  getBatch(id: string): ReconciliationBatch | undefined {
    return this.reconciliationBatches.get(id);
  }

  getAllBatches(): ReconciliationBatch[] {
    return Array.from(this.reconciliationBatches.values());
  }

  saveReconciliationRecord(record: ReconciliationRecord): void {
    record.updatedAt = new Date();
    this.reconciliationRecords.set(record.id, record);
  }

  saveReconciliationRecords(records: ReconciliationRecord[]): void {
    records.forEach(r => this.saveReconciliationRecord(r));
  }

  getReconciliationRecord(id: string): ReconciliationRecord | undefined {
    return this.reconciliationRecords.get(id);
  }

  getRecordsByBatch(batchId: string): ReconciliationRecord[] {
    return Array.from(this.reconciliationRecords.values()).filter(
      r => r.batchId === batchId
    );
  }

  updateBatchStats(batchId: string): void {
    const records = this.getRecordsByBatch(batchId);
    const batch = this.getBatch(batchId);
    if (!batch) return;

    batch.totalRecords = records.length;
    batch.matchedCount = records.filter(r => r.status === 'matched').length;
    batch.discrepancyCount = records.filter(r => r.status === 'discrepancy').length;
    batch.reviewingCount = records.filter(r => r.status === 'reviewing').length;
    batch.approvedCount = records.filter(r => r.status === 'approved').length;
    batch.rejectedCount = records.filter(r => r.status === 'rejected').length;
    batch.supplementCount = records.filter(r => r.status === 'supplement').length;

    this.saveBatch(batch);
  }
}

export default DataStore.getInstance();
