import { ExperimentPollution, OperationLog } from './types';
import { v4 as uuidv4 } from 'uuid';

class DataStore {
  private records: Map<string, ExperimentPollution> = new Map();

  generateId(): string {
    return uuidv4();
  }

  save(record: ExperimentPollution): void {
    this.records.set(record.id, record);
  }

  findById(id: string): ExperimentPollution | undefined {
    return this.records.get(id);
  }

  findAll(): ExperimentPollution[] {
    return Array.from(this.records.values());
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }

  addOperationLog(recordId: string, log: Omit<OperationLog, 'id' | 'recordId'>): void {
    const record = this.records.get(recordId);
    if (record) {
      record.operationLogs.push({
        ...log,
        id: this.generateId(),
        recordId
      });
      record.updatedAt = new Date();
    }
  }
}

export const dataStore = new DataStore();
