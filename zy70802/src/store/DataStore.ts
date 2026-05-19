import { v4 as uuidv4 } from 'uuid';
import {
  CriticalValueRecord,
  CallbackRecord,
  DutySchedule,
  ReconciliationResult,
  ReviewAction,
} from '../types';

export class DataStore {
  private static instance: DataStore;
  
  private criticalValues: Map<string, CriticalValueRecord>;
  private callbacks: Map<string, CallbackRecord>;
  private dutySchedules: Map<string, DutySchedule>;
  private reconciliations: Map<string, ReconciliationResult>;
  private reviewActions: Map<string, ReviewAction[]>;

  private constructor() {
    this.criticalValues = new Map();
    this.callbacks = new Map();
    this.dutySchedules = new Map();
    this.reconciliations = new Map();
    this.reviewActions = new Map();
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  addCriticalValue(record: Omit<CriticalValueRecord, 'id'>): CriticalValueRecord {
    const id = uuidv4();
    const newRecord = { ...record, id };
    this.criticalValues.set(id, newRecord);
    return newRecord;
  }

  addCriticalValues(records: Omit<CriticalValueRecord, 'id'>[]): CriticalValueRecord[] {
    return records.map(r => this.addCriticalValue(r));
  }

  getCriticalValue(id: string): CriticalValueRecord | undefined {
    return this.criticalValues.get(id);
  }

  getAllCriticalValues(): CriticalValueRecord[] {
    return Array.from(this.criticalValues.values());
  }

  updateCriticalValue(id: string, updates: Partial<CriticalValueRecord>): CriticalValueRecord | undefined {
    const record = this.criticalValues.get(id);
    if (record) {
      const updated = { ...record, ...updates };
      this.criticalValues.set(id, updated);
      return updated;
    }
    return undefined;
  }

  addCallback(record: Omit<CallbackRecord, 'id'>): CallbackRecord {
    const id = uuidv4();
    const newRecord = { ...record, id };
    this.callbacks.set(id, newRecord);
    return newRecord;
  }

  addCallbacks(records: Omit<CallbackRecord, 'id'>[]): CallbackRecord[] {
    return records.map(r => this.addCallback(r));
  }

  getCallback(id: string): CallbackRecord | undefined {
    return this.callbacks.get(id);
  }

  getAllCallbacks(): CallbackRecord[] {
    return Array.from(this.callbacks.values());
  }

  updateCallback(id: string, updates: Partial<CallbackRecord>): CallbackRecord | undefined {
    const record = this.callbacks.get(id);
    if (record) {
      const updated = { ...record, ...updates };
      this.callbacks.set(id, updated);
      return updated;
    }
    return undefined;
  }

  addDutySchedule(record: Omit<DutySchedule, 'id'>): DutySchedule {
    const id = uuidv4();
    const newRecord = { ...record, id };
    this.dutySchedules.set(id, newRecord);
    return newRecord;
  }

  addDutySchedules(records: Omit<DutySchedule, 'id'>[]): DutySchedule[] {
    return records.map(r => this.addDutySchedule(r));
  }

  getDutySchedule(id: string): DutySchedule | undefined {
    return this.dutySchedules.get(id);
  }

  getAllDutySchedules(): DutySchedule[] {
    return Array.from(this.dutySchedules.values());
  }

  getDutySchedulesByDateAndShift(date: Date, shift: string): DutySchedule[] {
    return Array.from(this.dutySchedules.values()).filter(
      ds => ds.date.toDateString() === date.toDateString() && ds.shift === shift
    );
  }

  addReconciliation(record: Omit<ReconciliationResult, 'id'>): ReconciliationResult {
    const id = uuidv4();
    const newRecord = { ...record, id };
    this.reconciliations.set(id, newRecord);
    return newRecord;
  }

  addReconciliations(records: Omit<ReconciliationResult, 'id'>[]): ReconciliationResult[] {
    return records.map(r => this.addReconciliation(r));
  }

  getReconciliation(id: string): ReconciliationResult | undefined {
    return this.reconciliations.get(id);
  }

  getAllReconciliations(): ReconciliationResult[] {
    return Array.from(this.reconciliations.values());
  }

  updateReconciliation(id: string, updates: Partial<ReconciliationResult>): ReconciliationResult | undefined {
    const record = this.reconciliations.get(id);
    if (record) {
      const updated = { ...record, ...updates };
      this.reconciliations.set(id, updated);
      return updated;
    }
    return undefined;
  }

  clearReconciliations(): void {
    this.reconciliations.clear();
  }

  addReviewAction(action: Omit<ReviewAction, 'id'>): ReviewAction {
    const id = uuidv4();
    const newAction = { ...action, id };
    const actions = this.reviewActions.get(action.reconciliationId) || [];
    actions.push(newAction);
    this.reviewActions.set(action.reconciliationId, actions);
    return newAction;
  }

  getReviewActions(reconciliationId: string): ReviewAction[] {
    return this.reviewActions.get(reconciliationId) || [];
  }

  getAllReviewActions(): ReviewAction[] {
    return Array.from(this.reviewActions.values()).flat();
  }

  clearAll(): void {
    this.criticalValues.clear();
    this.callbacks.clear();
    this.dutySchedules.clear();
    this.reconciliations.clear();
    this.reviewActions.clear();
  }
}
