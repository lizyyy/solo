import {
  RegistrationRecord,
  WaitlistRecord,
  CheckInRecord,
  BlacklistRecord,
  ReconciliationRecord,
  ReconciliationBatch,
} from '../types';

export class DataStore {
  private static instance: DataStore;
  
  private registrations: Map<string, RegistrationRecord> = new Map();
  private waitlist: Map<string, WaitlistRecord> = new Map();
  private checkIns: Map<string, CheckInRecord> = new Map();
  private blacklist: Map<string, BlacklistRecord> = new Map();
  private reconciliationBatches: Map<string, ReconciliationBatch> = new Map();
  private reconciliationRecords: Map<string, ReconciliationRecord> = new Map();

  private constructor() {}

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  public saveRegistrations(records: RegistrationRecord[]): void {
    records.forEach((r) => this.registrations.set(r.id, r));
  }

  public getRegistration(id: string): RegistrationRecord | undefined {
    return this.registrations.get(id);
  }

  public getAllRegistrations(): RegistrationRecord[] {
    return Array.from(this.registrations.values());
  }

  public saveWaitlist(records: WaitlistRecord[]): void {
    records.forEach((r) => this.waitlist.set(r.id, r));
  }

  public getWaitlistRecord(id: string): WaitlistRecord | undefined {
    return this.waitlist.get(id);
  }

  public getAllWaitlist(): WaitlistRecord[] {
    return Array.from(this.waitlist.values());
  }

  public saveCheckIns(records: CheckInRecord[]): void {
    records.forEach((r) => this.checkIns.set(r.id, r));
  }

  public getCheckIn(id: string): CheckInRecord | undefined {
    return this.checkIns.get(id);
  }

  public getAllCheckIns(): CheckInRecord[] {
    return Array.from(this.checkIns.values());
  }

  public saveBlacklist(records: BlacklistRecord[]): void {
    records.forEach((r) => this.blacklist.set(r.id, r));
  }

  public getBlacklistRecord(id: string): BlacklistRecord | undefined {
    return this.blacklist.get(id);
  }

  public getAllBlacklist(): BlacklistRecord[] {
    return Array.from(this.blacklist.values());
  }

  public saveReconciliationBatch(batch: ReconciliationBatch): void {
    this.reconciliationBatches.set(batch.id, batch);
  }

  public getReconciliationBatch(id: string): ReconciliationBatch | undefined {
    return this.reconciliationBatches.get(id);
  }

  public getAllReconciliationBatches(): ReconciliationBatch[] {
    return Array.from(this.reconciliationBatches.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public saveReconciliationRecords(records: ReconciliationRecord[]): void {
    records.forEach((r) => this.reconciliationRecords.set(r.id, r));
  }

  public updateReconciliationRecord(record: ReconciliationRecord): void {
    this.reconciliationRecords.set(record.id, record);
  }

  public getReconciliationRecord(id: string): ReconciliationRecord | undefined {
    return this.reconciliationRecords.get(id);
  }

  public getReconciliationRecordsByBatch(batchId: string): ReconciliationRecord[] {
    return Array.from(this.reconciliationRecords.values())
      .filter((r) => r.reconciliationBatchId === batchId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAllReconciliationRecords(): ReconciliationRecord[] {
    return Array.from(this.reconciliationRecords.values());
  }

  public clearAll(): void {
    this.registrations.clear();
    this.waitlist.clear();
    this.checkIns.clear();
    this.blacklist.clear();
    this.reconciliationBatches.clear();
    this.reconciliationRecords.clear();
  }

  public clearImportedData(): void {
    this.registrations.clear();
    this.waitlist.clear();
    this.checkIns.clear();
    this.blacklist.clear();
  }
}
