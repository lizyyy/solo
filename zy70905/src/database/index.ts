import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { ProcessingResult, ReceiptItem, Member, ActivityRule } from '../types';

interface BatchRecord {
  id: string;
  batchHash: string;
  totalCount: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  totalPoints: number;
  createdAt: string;
}

interface Record {
  id: string;
  batchId: string;
  receiptNo: string;
  memberPhone: string;
  transactionTime: string;
  amount: number;
  calculatedPoints: number;
  status: 'success' | 'pending' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  suggestion?: string;
  rawData: ReceiptItem;
  appliedRules: string[];
  traceId: string;
  createdAt: string;
}

interface DataStore {
  batches: BatchRecord[];
  records: Record[];
  members: Member[];
  rules: ActivityRule[];
}

class PointsDatabase {
  private dataPath: string;
  private data: DataStore;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || path.join(process.cwd(), 'data-store.json');
    this.data = this.loadData();
  }

  private loadData(): DataStore {
    if (fs.existsSync(this.dataPath)) {
      try {
        const content = fs.readFileSync(this.dataPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        // ignore
      }
    }
    return {
      batches: [],
      records: [],
      members: [],
      rules: []
    };
  }

  private saveData() {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  generateBatchHash(receipts: ReceiptItem[]): string {
    const sorted = [...receipts].sort((a, b) => a.receiptNo.localeCompare(b.receiptNo));
    const data = JSON.stringify(sorted.map(r => `${r.receiptNo}-${r.amount}-${r.transactionTime}`));
    return createHash('md5').update(data).digest('hex');
  }

  isBatchProcessed(hash: string): boolean {
    return this.data.batches.some(b => b.batchHash === hash);
  }

  saveBatch(batchId: string, hash: string, report: {
    totalCount: number;
    successCount: number;
    pendingCount: number;
    failedCount: number;
    totalPoints: number;
  }) {
    this.data.batches.push({
      id: batchId,
      batchHash: hash,
      ...report,
      createdAt: new Date().toISOString()
    });
    this.saveData();
  }

  getBatch(batchId: string) {
    return this.data.batches.find(b => b.id === batchId);
  }

  saveRecord(result: ProcessingResult, batchId: string) {
    this.data.records.push({
      id: uuidv4(),
      batchId,
      receiptNo: result.receiptNo,
      memberPhone: result.originalData.memberPhone,
      transactionTime: result.originalData.transactionTime,
      amount: result.originalData.amount,
      calculatedPoints: result.calculatedPoints,
      status: result.status,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      suggestion: result.suggestion,
      rawData: result.originalData,
      appliedRules: result.appliedRules,
      traceId: result.traceId,
      createdAt: new Date().toISOString()
    });
    this.saveData();
  }

  getRecordByTraceId(traceId: string) {
    return this.data.records.find(r => r.traceId === traceId);
  }

  getRecordsByBatch(batchId: string) {
    return this.data.records.filter(r => r.batchId === batchId);
  }

  getRecordsByMember(memberPhone: string) {
    return this.data.records
      .filter(r => r.memberPhone === memberPhone)
      .sort((a, b) => b.transactionTime.localeCompare(a.transactionTime));
  }

  getReceiptHistory(receiptNo: string) {
    return this.data.records
      .filter(r => r.receiptNo === receiptNo)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveMember(member: Member) {
    const idx = this.data.members.findIndex(m => m.phone === member.phone);
    if (idx >= 0) {
      this.data.members[idx] = member;
    } else {
      this.data.members.push(member);
    }
    this.saveData();
  }

  getMember(phone: string) {
    return this.data.members.find(m => m.phone === phone);
  }

  getAllMembers(): Member[] {
    return this.data.members;
  }

  saveActivityRule(rule: ActivityRule) {
    const idx = this.data.rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      this.data.rules[idx] = rule;
    } else {
      this.data.rules.push(rule);
    }
    this.saveData();
  }

  getActivityRules(): ActivityRule[] {
    return this.data.rules
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  getPurchaseReceipt(receiptNo: string) {
    return this.data.records.find(r => r.receiptNo === receiptNo && r.status === 'success');
  }

  close() {
    this.saveData();
  }
}

export default PointsDatabase;
