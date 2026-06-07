import type { FinalRecord, ConflictRecord, RampRecord, SamplingRecord, ModificationLog } from '../../shared/types';
import { mockFinalRecords, mockConflictRecords } from './mockData';

const generateId = () => Math.random().toString(36).substring(2, 11);

class DataStore {
  private finalRecords: FinalRecord[] = [...mockFinalRecords];
  private conflictRecords: ConflictRecord[] = [...mockConflictRecords];
  private rampRecords: RampRecord[] = [];
  private samplingRecords: SamplingRecord[] = [];

  getFinalRecords(): FinalRecord[] {
    return [...this.finalRecords];
  }

  getFinalRecordById(id: string): FinalRecord | undefined {
    return this.finalRecords.find(r => r.id === id);
  }

  addFinalRecord(record: FinalRecord): void {
    this.finalRecords.push(record);
  }

  updateFinalRecord(id: string, updates: Partial<FinalRecord>): FinalRecord | undefined {
    const index = this.finalRecords.findIndex(r => r.id === id);
    if (index !== -1) {
      this.finalRecords[index] = { ...this.finalRecords[index], ...updates };
      return this.finalRecords[index];
    }
    return undefined;
  }

  getConflictRecords(): ConflictRecord[] {
    return [...this.conflictRecords];
  }

  addConflictRecord(record: ConflictRecord): void {
    this.conflictRecords.push(record);
  }

  updateConflictRecord(id: string, updates: Partial<ConflictRecord>): ConflictRecord | undefined {
    const index = this.conflictRecords.findIndex(r => r.id === id);
    if (index !== -1) {
      this.conflictRecords[index] = { ...this.conflictRecords[index], ...updates };
      return this.conflictRecords[index];
    }
    return undefined;
  }

  findFinalRecordByLocation(location: string): FinalRecord | undefined {
    return this.finalRecords.find(r => r.location === location);
  }

  addModificationLog(recordId: string, log: Omit<ModificationLog, 'id' | 'timestamp'>): void {
    const record = this.finalRecords.find(r => r.id === recordId);
    if (record) {
      const fullLog: ModificationLog = {
        ...log,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      record.modificationHistory.push(fullLog);
      record.lastModified = fullLog.timestamp;
      record.modifiedBy = log.operator;
    }
  }
}

export const dataStore = new DataStore();
