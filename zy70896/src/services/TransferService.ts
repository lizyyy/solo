import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage/FileStorage';
import {
  TransferRecord,
  Batch,
  RecordStatus,
  IssueType,
  Issue,
  QueryFilters,
  PaginatedResult,
  ProcessingHistory,
  ScheduleEntry,
  Teller
} from '../types';
import * as csvParser from 'csv-parser';
import * as stream from 'stream';
import { Readable } from 'stream';
import { Parser } from 'json2csv';

export class TransferService {
  private generateErrorNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ERR-${timestamp}-${random}`;
  }

  private detectIssues(record: Partial<TransferRecord>, schedules: ScheduleEntry[]): Issue[] {
    const issues: Issue[] = [];
    const now = new Date().toISOString();

    if (Math.abs(record.difference || 0) > 0.01) {
      issues.push({
        type: IssueType.AMOUNT_MISMATCH,
        description: `金额差异 ${(record.difference || 0).toFixed(2)} 元，需要核实`,
        detectedAt: now
      });
    }

    if (!record.firstSignature || !record.secondSignature) {
      issues.push({
        type: IssueType.MISSING_SIGNATURE,
        description: '缺少双签确认，请补充签名',
        detectedAt: now
      });
    }

    const schedule = schedules.find(s => s.tellerId === record.tellerId && s.date === record.transferDate);
    if (!schedule && record.transferDate) {
      issues.push({
        type: IssueType.CROSS_DAY_TRANSFER,
        description: '跨日交接记录，请确认排班信息',
        detectedAt: now
      });
    }

    return issues;
  }

  async parseCSV(fileContent: Buffer, batchId: string): Promise<TransferRecord[]> {
    const records: TransferRecord[] = [];
    const schedules = await storage.getSchedules();
    const tellers = await storage.getTellers();

    return new Promise((resolve, reject) => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileContent);

      bufferStream
        .pipe(csvParser())
        .on('data', (row) => {
          const teller = tellers.find(t => t.tellerId === row.tellerId);
          const now = new Date().toISOString();
          
          const previousAmount = parseFloat(row.previousAmount || '0');
          const currentAmount = parseFloat(row.currentAmount || '0');
          const difference = currentAmount - previousAmount;

          const partialRecord: Partial<TransferRecord> = {
            tellerId: row.tellerId,
            tellerName: teller?.name || row.tellerName || '',
            cashBoxId: teller?.cashBoxId || row.cashBoxId || '',
            transferDate: row.transferDate,
            transferTime: row.transferTime,
            previousAmount,
            currentAmount,
            difference,
            receivedBy: row.receivedBy,
            handedOverBy: row.handedOverBy,
            firstSignature: row.firstSignature,
            secondSignature: row.secondSignature
          };

          const issues = this.detectIssues(partialRecord, schedules);

          const record: TransferRecord = {
            id: uuidv4(),
            batchId,
            ...partialRecord,
            issues,
            status: issues.length > 0 ? RecordStatus.NEEDS_REVIEW : RecordStatus.PENDING,
            processingHistory: [{
              status: issues.length > 0 ? RecordStatus.NEEDS_REVIEW : RecordStatus.PENDING,
              handledBy: 'system',
              handledAt: now
            }],
            createdAt: now,
            updatedAt: now
          };

          records.push(record);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', reject);
    });
  }

  async createBatch(name: string, branchId: string, createdBy: string, description?: string): Promise<Batch> {
    const batch: Batch = {
      id: uuidv4(),
      name,
      description,
      branchId,
      createdBy,
      totalRecords: 0,
      processedRecords: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await storage.saveBatch(batch);
    return batch;
  }

  async addRecordsToBatch(batchId: string, records: TransferRecord[]): Promise<void> {
    await storage.saveRecords(records);
    const batches = await storage.getBatches();
    const batch = batches.find(b => b.id === batchId);
    if (batch) {
      batch.totalRecords += records.length;
      batch.updatedAt = new Date().toISOString();
      await storage.saveBatch(batch);
    }
  }

  async updateRecordStatus(
    recordId: string,
    status: RecordStatus,
    handledBy: string,
    comment?: string
  ): Promise<TransferRecord | null> {
    const records = await storage.getRecords();
    const record = records.find(r => r.id === recordId);
    
    if (!record) {
      return null;
    }

    const historyEntry: ProcessingHistory = {
      status,
      handledBy,
      handledAt: new Date().toISOString(),
      comment
    };

    record.processingHistory.push(historyEntry);
    record.status = status;
    record.updatedAt = new Date().toISOString();

    await storage.saveRecord(record);
    return record;
  }

  async markProcessed(recordId: string, handledBy: string, comment?: string): Promise<TransferRecord | null> {
    return this.updateRecordStatus(recordId, RecordStatus.PROCESSED, handledBy, comment);
  }

  async returnForCorrection(recordId: string, handledBy: string, comment: string): Promise<TransferRecord | null> {
    return this.updateRecordStatus(recordId, RecordStatus.RETURNED, handledBy, comment);
  }

  async approveRecord(recordId: string, handledBy: string, comment?: string): Promise<TransferRecord | null> {
    return this.updateRecordStatus(recordId, RecordStatus.APPROVED, handledBy, comment);
  }

  async queryRecords(filters: QueryFilters, page: number = 1, pageSize: number = 50): Promise<PaginatedResult<TransferRecord>> {
    let records = await storage.getRecords();
    const schedules = await storage.getSchedules();

    if (filters.cashBoxId) {
      records = records.filter(r => r.cashBoxId === filters.cashBoxId);
    }

    if (filters.supervisorId) {
      const supervisedTellers = schedules
        .filter(s => s.supervisorId === filters.supervisorId)
        .map(s => s.tellerId);
      records = records.filter(r => supervisedTellers.includes(r.tellerId));
    }

    if (filters.errorNumber) {
      records = records.filter(r => r.errorNumber === filters.errorNumber);
    }

    if (filters.tellerId) {
      records = records.filter(r => r.tellerId === filters.tellerId);
    }

    if (filters.status) {
      records = records.filter(r => r.status === filters.status);
    }

    if (filters.batchId) {
      records = records.filter(r => r.batchId === filters.batchId);
    }

    if (filters.startDate) {
      records = records.filter(r => r.transferDate >= filters.startDate!);
    }

    if (filters.endDate) {
      records = records.filter(r => r.transferDate <= filters.endDate!);
    }

    const total = records.length;
    const start = (page - 1) * pageSize;
    const paginatedData = records.slice(start, start + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize
    };
  }

  async exportRecords(filters: QueryFilters): Promise<Buffer> {
    const result = await this.queryRecords(filters, 1, 10000);
    
    const exportData = result.data.map(record => ({
      '记录编号': record.id,
      '批次编号': record.batchId,
      '柜员ID': record.tellerId,
      '柜员姓名': record.tellerName,
      '尾箱编号': record.cashBoxId,
      '交接日期': record.transferDate,
      '交接时间': record.transferTime,
      '上期金额': record.previousAmount.toFixed(2),
      '本期金额': record.currentAmount.toFixed(2),
      '差额': record.difference.toFixed(2),
      '接收人': record.receivedBy,
      '移交人': record.handedOverBy,
      '状态': record.status,
      '问题数量': record.issues.length,
      '问题描述': record.issues.map(i => `${i.type}: ${i.description}`).join('; '),
      '差错编号': record.errorNumber || '',
      '创建时间': record.createdAt,
      '更新时间': record.updatedAt,
      '处理历史': record.processingHistory.map(h => 
        `${h.status} - ${h.handledBy} - ${h.handledAt}${h.comment ? ` (${h.comment})` : ''}`
      ).join(' | ')
    }));

    const parser = new Parser();
    const csv = parser.parse(exportData);
    return Buffer.from(csv, 'utf-8');
  }

  async getRecordById(recordId: string): Promise<TransferRecord | undefined> {
    const records = await storage.getRecords();
    return records.find(r => r.id === recordId);
  }

  async getBatchById(batchId: string): Promise<Batch | undefined> {
    const batches = await storage.getBatches();
    return batches.find(b => b.id === batchId);
  }

  async getAllBatches(): Promise<Batch[]> {
    return storage.getBatches();
  }

  async getTellers(): Promise<Teller[]> {
    return storage.getTellers();
  }

  async getSchedules(): Promise<ScheduleEntry[]> {
    return storage.getSchedules();
  }

  async saveTellers(tellers: Teller[]): Promise<void> {
    await storage.saveTellers(tellers);
  }

  async saveSchedules(schedules: ScheduleEntry[]): Promise<void> {
    await storage.saveSchedules(schedules);
  }
}

export const transferService = new TransferService();
