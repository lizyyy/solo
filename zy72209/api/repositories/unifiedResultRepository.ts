import type { CreditRecord, OperationLog, ImportHistory } from '../../shared/types';
import { mockRecords, mockImportHistory, mockOperationLogs } from '../data/mockData';
import crypto from 'crypto';

class UnifiedResultRepository {
  private records: CreditRecord[] = [...mockRecords];
  private importHistory: ImportHistory[] = [...mockImportHistory];
  private operationLogs: OperationLog[] = [...mockOperationLogs];
  private institutionNameHistory: Map<string, string[]> = new Map();

  constructor() {
    this.initInstitutionNameHistory();
  }

  private initInstitutionNameHistory() {
    this.records.forEach(record => {
      const history = this.institutionNameHistory.get(record.institutionCode) || [];
      if (!history.includes(record.institutionNamePrev)) {
        history.push(record.institutionNamePrev);
      }
      if (!history.includes(record.institutionNameCurrent)) {
        history.push(record.institutionNameCurrent);
      }
      this.institutionNameHistory.set(record.institutionCode, history);
    });
  }

  private generateId(prefix: string): string {
    return `${prefix}${Date.now().toString(36).toUpperCase()}`;
  }

  private calculateDataHash(data: any): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  getAllRecords(): { records: CreditRecord[]; dataHash: string } {
    const sortedRecords = [...this.records].sort((a, b) => 
      b.importTime.localeCompare(a.importTime)
    );
    return {
      records: sortedRecords,
      dataHash: this.calculateDataHash(sortedRecords)
    };
  }

  getRecordById(id: string): CreditRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  getInstitutionNameHistory(code: string): string[] {
    return this.institutionNameHistory.get(code) || [];
  }

  addRecord(record: Omit<CreditRecord, 'id'>): CreditRecord {
    const newRecord: CreditRecord = {
      ...record,
      id: this.generateId('REC')
    };
    this.records.push(newRecord);
    
    const history = this.institutionNameHistory.get(newRecord.institutionCode) || [];
    if (!history.includes(newRecord.institutionNamePrev)) {
      history.push(newRecord.institutionNamePrev);
    }
    if (!history.includes(newRecord.institutionNameCurrent)) {
      history.push(newRecord.institutionNameCurrent);
    }
    this.institutionNameHistory.set(newRecord.institutionCode, history);
    
    return newRecord;
  }

  updateRecord(id: string, updates: Partial<CreditRecord>): CreditRecord | undefined {
    const index = this.records.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    
    const beforeData = JSON.parse(JSON.stringify(this.records[index]));
    this.records[index] = {
      ...this.records[index],
      ...updates,
      updateTime: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    
    this.addOperationLog({
      recordId: id,
      operationType: 'recalculate',
      operator: updates.operator || '系统',
      operationTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      beforeData,
      afterData: JSON.parse(JSON.stringify(this.records[index]))
    });
    
    return this.records[index];
  }

  checkDuplicateImport(fileHash: string): boolean {
    return this.importHistory.some(h => h.fileHash === fileHash);
  }

  checkDuplicateInstitutionDate(institutionCode: string, confirmDate: string): CreditRecord | undefined {
    return this.records.find(
      r => r.institutionCode === institutionCode && 
           r.custodianData.confirmDate === confirmDate
    );
  }

  addImportHistory(history: Omit<ImportHistory, 'id'>): ImportHistory {
    const newHistory: ImportHistory = {
      ...history,
      id: this.generateId('IMP')
    };
    this.importHistory.push(newHistory);
    return newHistory;
  }

  addOperationLog(log: Omit<OperationLog, 'id'>): OperationLog {
    const newLog: OperationLog = {
      ...log,
      id: this.generateId('LOG')
    };
    this.operationLogs.push(newLog);
    return newLog;
  }

  getOperationLogsByRecordId(recordId: string): OperationLog[] {
    return this.operationLogs
      .filter(l => l.recordId === recordId)
      .sort((a, b) => b.operationTime.localeCompare(a.operationTime));
  }

  getDataHash(): string {
    return this.calculateDataHash(this.records);
  }
}

export const unifiedResultRepository = new UnifiedResultRepository();
