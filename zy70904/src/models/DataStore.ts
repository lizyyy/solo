import { v4 as uuidv4 } from 'uuid';
import {
  Batch,
  ProcessingRecord,
  Member,
  ActivityRule,
  OperationLog,
  Receipt,
  QueryParams,
  PaginatedResult,
  RecordStatus,
  MemberLevel,
  OperationType,
  BoundaryInfo
} from '../types';

class DataStore {
  private static instance: DataStore;
  
  private batches: Map<string, Batch> = new Map();
  private processingRecords: Map<string, ProcessingRecord> = new Map();
  private members: Map<string, Member> = new Map();
  private activityRules: Map<string, ActivityRule> = new Map();
  private operationLogs: Map<string, OperationLog> = new Map();
  private receipts: Map<string, Receipt> = new Map();

  private constructor() {}

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  generateId(): string {
    return uuidv4();
  }

  saveBatch(batch: Batch): Batch {
    this.batches.set(batch.id, batch);
    return batch;
  }

  getBatch(id: string): Batch | undefined {
    return this.batches.get(id);
  }

  getBatchByNo(batchNo: string): Batch | undefined {
    return Array.from(this.batches.values()).find(b => b.batchNo === batchNo);
  }

  getAllBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  saveProcessingRecord(record: ProcessingRecord): ProcessingRecord {
    this.processingRecords.set(record.id, record);
    return record;
  }

  getProcessingRecord(id: string): ProcessingRecord | undefined {
    return this.processingRecords.get(id);
  }

  getProcessingRecordsByBatch(batchId: string): ProcessingRecord[] {
    return Array.from(this.processingRecords.values()).filter(r => r.batchId === batchId);
  }

  getProcessingRecordByReceiptNo(receiptNo: string): ProcessingRecord | undefined {
    return Array.from(this.processingRecords.values()).find(r => r.receiptNo === receiptNo);
  }

  queryProcessingRecords(params: QueryParams): PaginatedResult<ProcessingRecord> {
    let records = Array.from(this.processingRecords.values());

    if (params.memberLevel) {
      records = records.filter(r => r.memberLevel === params.memberLevel);
    }
    if (params.receiptNo) {
      records = records.filter(r => r.receiptNo.includes(params.receiptNo!));
    }
    if (params.activityCode) {
      records = records.filter(r => r.activityCode === params.activityCode);
    }
    if (params.startDate) {
      records = records.filter(r => r.transactionTime >= params.startDate!);
    }
    if (params.endDate) {
      records = records.filter(r => r.transactionTime <= params.endDate!);
    }
    if (params.status) {
      records = records.filter(r => r.status === params.status);
    }
    if (params.storeCode) {
      records = records.filter(r => {
        const batch = this.batches.get(r.batchId);
        return batch && batch.storeCode === params.storeCode;
      });
    }

    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const total = records.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = records.slice(start, start + pageSize);

    return { data, total, page, pageSize, totalPages };
  }

  saveMember(member: Member): Member {
    this.members.set(member.id, member);
    return member;
  }

  getMemberByMemberId(memberId: string): Member | undefined {
    return Array.from(this.members.values()).find(m => m.memberId === memberId);
  }

  getMemberByPhone(phone: string): Member | undefined {
    return Array.from(this.members.values()).find(m => m.phone === phone);
  }

  saveActivityRule(rule: ActivityRule): ActivityRule {
    this.activityRules.set(rule.id, rule);
    return rule;
  }

  getActivityRule(code: string): ActivityRule | undefined {
    return Array.from(this.activityRules.values()).find(r => r.activityCode === code);
  }

  getAllActivityRules(): ActivityRule[] {
    return Array.from(this.activityRules.values());
  }

  saveReceipt(receipt: Receipt): Receipt {
    this.receipts.set(receipt.id, receipt);
    return receipt;
  }

  getReceiptByNo(receiptNo: string): Receipt | undefined {
    return Array.from(this.receipts.values()).find(r => r.receiptNo === receiptNo);
  }

  addOperationLog(log: Omit<OperationLog, 'id' | 'createdAt'>): OperationLog {
    const operationLog: OperationLog = {
      ...log,
      id: uuidv4(),
      createdAt: new Date()
    };
    this.operationLogs.set(operationLog.id, operationLog);
    return operationLog;
  }

  getOperationLogs(recordId?: string, batchId?: string): OperationLog[] {
    let logs = Array.from(this.operationLogs.values());
    if (recordId) {
      logs = logs.filter(l => l.recordId === recordId);
    }
    if (batchId) {
      logs = logs.filter(l => l.batchId === batchId);
    }
    return logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  clear(): void {
    this.batches.clear();
    this.processingRecords.clear();
    this.members.clear();
    this.activityRules.clear();
    this.operationLogs.clear();
    this.receipts.clear();
  }
}

export default DataStore.getInstance();
