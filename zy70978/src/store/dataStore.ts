import { v4 as uuidv4 } from 'uuid';
import {
  RentalOrder,
  RepairRecord,
  DepositRule,
  Discrepancy,
  ReviewRecord,
  ReconciliationResult,
} from '../types';

class DataStore {
  private rentalOrders: Map<string, RentalOrder> = new Map();
  private repairRecords: Map<string, RepairRecord> = new Map();
  private depositRules: Map<string, DepositRule> = new Map();
  private discrepancies: Map<string, Discrepancy> = new Map();
  private reviewRecords: Map<string, ReviewRecord> = new Map();
  private reconciliationResults: Map<string, ReconciliationResult> = new Map();

  generateId(): string {
    return uuidv4();
  }

  addRentalOrder(order: Omit<RentalOrder, 'id'>): RentalOrder {
    const id = this.generateId();
    const newOrder = { ...order, id };
    this.rentalOrders.set(id, newOrder);
    return newOrder;
  }

  getRentalOrder(id: string): RentalOrder | undefined {
    return this.rentalOrders.get(id);
  }

  getRentalOrderByNo(orderNo: string): RentalOrder | undefined {
    return Array.from(this.rentalOrders.values()).find(
      (o) => o.orderNo === orderNo
    );
  }

  getAllRentalOrders(): RentalOrder[] {
    return Array.from(this.rentalOrders.values());
  }

  updateRentalOrder(id: string, updates: Partial<RentalOrder>): RentalOrder | undefined {
    const order = this.rentalOrders.get(id);
    if (!order) return undefined;
    const updated = { ...order, ...updates };
    this.rentalOrders.set(id, updated);
    return updated;
  }

  addRepairRecord(record: Omit<RepairRecord, 'id'>): RepairRecord {
    const id = this.generateId();
    const newRecord = { ...record, id };
    this.repairRecords.set(id, newRecord);
    return newRecord;
  }

  getRepairRecord(id: string): RepairRecord | undefined {
    return this.repairRecords.get(id);
  }

  getRepairRecordsBySerialNo(serialNo: string): RepairRecord[] {
    return Array.from(this.repairRecords.values()).filter(
      (r) => r.equipmentSerialNo === serialNo
    );
  }

  getRepairRecordsByOrderNo(orderNo: string): RepairRecord[] {
    return Array.from(this.repairRecords.values()).filter(
      (r) => r.boundOrderNo === orderNo
    );
  }

  getAllRepairRecords(): RepairRecord[] {
    return Array.from(this.repairRecords.values());
  }

  updateRepairRecord(id: string, updates: Partial<RepairRecord>): RepairRecord | undefined {
    const record = this.repairRecords.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...updates };
    this.repairRecords.set(id, updated);
    return updated;
  }

  addDepositRule(rule: Omit<DepositRule, 'id'>): DepositRule {
    const id = this.generateId();
    const newRule = { ...rule, id };
    this.depositRules.set(id, newRule);
    return newRule;
  }

  getDepositRule(id: string): DepositRule | undefined {
    return this.depositRules.get(id);
  }

  getActiveDepositRules(): DepositRule[] {
    return Array.from(this.depositRules.values()).filter((r) => r.isActive);
  }

  getAllDepositRules(): DepositRule[] {
    return Array.from(this.depositRules.values());
  }

  updateDepositRule(id: string, updates: Partial<DepositRule>): DepositRule | undefined {
    const rule = this.depositRules.get(id);
    if (!rule) return undefined;
    const updated = { ...rule, ...updates };
    this.depositRules.set(id, updated);
    return updated;
  }

  addDiscrepancy(discrepancy: Omit<Discrepancy, 'id'>): Discrepancy {
    const id = this.generateId();
    const newDiscrepancy = { ...discrepancy, id };
    this.discrepancies.set(id, newDiscrepancy);
    return newDiscrepancy;
  }

  getDiscrepanciesByOrderNo(orderNo: string): Discrepancy[] {
    return Array.from(this.discrepancies.values()).filter(
      (d) => d.orderNo === orderNo
    );
  }

  updateDiscrepancy(id: string, updates: Partial<Discrepancy>): Discrepancy | undefined {
    const discrepancy = this.discrepancies.get(id);
    if (!discrepancy) return undefined;
    const updated = { ...discrepancy, ...updates };
    this.discrepancies.set(id, updated);
    return updated;
  }

  addReviewRecord(record: Omit<ReviewRecord, 'id'>): ReviewRecord {
    const id = this.generateId();
    const newRecord = { ...record, id };
    this.reviewRecords.set(id, newRecord);
    return newRecord;
  }

  getReviewRecordsByOrderNo(orderNo: string): ReviewRecord[] {
    return Array.from(this.reviewRecords.values())
      .filter((r) => r.orderNo === orderNo)
      .sort((a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime());
  }

  setReconciliationResult(result: ReconciliationResult): void {
    this.reconciliationResults.set(result.orderNo, result);
  }

  getReconciliationResult(orderNo: string): ReconciliationResult | undefined {
    return this.reconciliationResults.get(orderNo);
  }

  getAllReconciliationResults(): ReconciliationResult[] {
    return Array.from(this.reconciliationResults.values());
  }

  clearAll(): void {
    this.rentalOrders.clear();
    this.repairRecords.clear();
    this.depositRules.clear();
    this.discrepancies.clear();
    this.reviewRecords.clear();
    this.reconciliationResults.clear();
  }
}

export const dataStore = new DataStore();
