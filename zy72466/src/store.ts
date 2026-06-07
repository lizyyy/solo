import { ComplaintRecord, StatusChangeLog, UnifiedQueryParams } from './types';

class DataStore {
  private records: Map<string, ComplaintRecord> = new Map();
  private logs: Map<string, StatusChangeLog> = new Map();
  private static instance: DataStore;

  private constructor() {}

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  saveRecord(record: ComplaintRecord): void {
    this.records.set(record.id, { ...record, updatedAt: new Date().toISOString() });
  }

  getRecord(id: string): ComplaintRecord | undefined {
    const record = this.records.get(id);
    return record ? { ...record } : undefined;
  }

  getAllRecords(): ComplaintRecord[] {
    return Array.from(this.records.values())
      .filter(r => !r.isDeleted)
      .map(r => ({ ...r }));
  }

  queryRecords(params: UnifiedQueryParams): ComplaintRecord[] {
    return this.getAllRecords().filter(record => {
      if (params.status && record.currentStatus !== params.status) return false;
      if (params.district && record.samplingPoint.district !== params.district) return false;
      if (params.street && record.samplingPoint.street !== params.street) return false;
      if (params.isMissingSampling !== undefined) {
        if (!record.heatmap) return false;
        if (record.heatmap.isMissingSampling !== params.isMissingSampling) return false;
      }
      if (params.startDate) {
        if (new Date(record.createdAt) < new Date(params.startDate)) return false;
      }
      if (params.endDate) {
        if (new Date(record.createdAt) > new Date(params.endDate)) return false;
      }
      return true;
    });
  }

  saveLog(log: StatusChangeLog): void {
    this.logs.set(log.id, { ...log });
  }

  getLogsForRecord(recordId: string): StatusChangeLog[] {
    return Array.from(this.logs.values())
      .filter(log => log.recordId === recordId)
      .sort((a, b) => new Date(a.operationTime).getTime() - new Date(b.operationTime).getTime())
      .map(log => ({ ...log }));
  }

  clearAll(): void {
    this.records.clear();
    this.logs.clear();
  }
}

export const dataStore = DataStore.getInstance();
