import { v4 as uuidv4 } from 'uuid';
import {
  AccountFreezeRecord,
  AccountFreezeRequest,
  FreezeStatus,
  AuditLog,
  MigrationReportFilter
} from '../types';

export class RecordStore {
  private records: Map<string, AccountFreezeRecord> = new Map();
  private requestIdToRecordId: Map<string, string> = new Map();

  createRecord(request: AccountFreezeRequest): AccountFreezeRecord {
    const recordId = uuidv4();
    const now = new Date();

    const record: AccountFreezeRecord = {
      recordId,
      requestId: request.requestId,
      accountId: request.accountId,
      accountName: request.accountName,
      freezeReason: request.freezeReason,
      reasonDetail: request.reasonDetail,
      status: FreezeStatus.PENDING_REVIEW,
      operatorId: request.operatorId,
      operatorName: request.operatorName,
      clientParameters: request.clientParameters,
      clientVersion: request.clientVersion,
      parameterSource: request.parameterSource,
      riskScore: request.riskScore,
      auditLogs: [],
      createdAt: request.createdAt || now,
      updatedAt: now,
      isHistorical: false
    };

    this.records.set(recordId, record);
    this.requestIdToRecordId.set(request.requestId, recordId);

    return record;
  }

  findByRequestId(requestId: string): AccountFreezeRecord | undefined {
    const recordId = this.requestIdToRecordId.get(requestId);
    return recordId ? this.records.get(recordId) : undefined;
  }

  findByRecordId(recordId: string): AccountFreezeRecord | undefined {
    return this.records.get(recordId);
  }

  updateRecord(recordId: string, updates: Partial<AccountFreezeRecord>): AccountFreezeRecord | undefined {
    const record = this.records.get(recordId);
    if (!record) return undefined;

    const updatedRecord = {
      ...record,
      ...updates,
      updatedAt: new Date()
    };

    this.records.set(recordId, updatedRecord);
    return updatedRecord;
  }

  addAuditLog(recordId: string, log: AuditLog): boolean {
    const record = this.records.get(recordId);
    if (!record) return false;

    record.auditLogs.push(log);
    record.updatedAt = new Date();
    this.records.set(recordId, record);
    return true;
  }

  markAsHistorical(recordId: string): boolean {
    const record = this.records.get(recordId);
    if (!record) return false;

    record.isHistorical = true;
    record.updatedAt = new Date();
    this.records.set(recordId, record);
    return true;
  }

  existsByRequestId(requestId: string): boolean {
    return this.requestIdToRecordId.has(requestId);
  }

  filterRecords(filter: MigrationReportFilter): AccountFreezeRecord[] {
    let result = Array.from(this.records.values());

    if (filter.startDate) {
      result = result.filter(r => r.createdAt >= filter.startDate!);
    }

    if (filter.endDate) {
      result = result.filter(r => r.createdAt <= filter.endDate!);
    }

    if (filter.status && filter.status.length > 0) {
      result = result.filter(r => filter.status!.includes(r.status));
    }

    if (filter.freezeReason && filter.freezeReason.length > 0) {
      result = result.filter(r => filter.freezeReason!.includes(r.freezeReason));
    }

    if (filter.accountId) {
      result = result.filter(r => r.accountId.includes(filter.accountId!));
    }

    if (filter.operatorId) {
      result = result.filter(r => r.operatorId === filter.operatorId);
    }

    if (filter.includeHistorical === false) {
      result = result.filter(r => !r.isHistorical);
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAllRecords(): AccountFreezeRecord[] {
    return Array.from(this.records.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  clear(): void {
    this.records.clear();
    this.requestIdToRecordId.clear();
  }

  getCount(): number {
    return this.records.size;
  }
}

export const recordStore = new RecordStore();
