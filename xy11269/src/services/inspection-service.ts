import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import {
  InspectionRecord,
  InspectionStatus,
  SensitiveWord,
  TranscriptionRecord,
  InspectionSummary,
  ReviewRequest,
  IssueType
} from '../models/types';
import { JsonStorage } from '../storage/json-storage';
import { TextInspector } from './text-inspector';
import { DataMasker } from '../utils/data-masker';

export class InspectionService {
  private recordStorage: JsonStorage<InspectionRecord>;
  private sensitiveWordStorage: JsonStorage<SensitiveWord>;
  private textInspector: TextInspector;
  private exportsDir: string;

  constructor(dataDir: string) {
    this.recordStorage = new JsonStorage<InspectionRecord>({
      filePath: path.join(dataDir, 'inspection-records.json')
    });

    this.sensitiveWordStorage = new JsonStorage<SensitiveWord>({
      filePath: path.join(dataDir, 'sensitive-words.json')
    });

    this.exportsDir = path.join(path.dirname(dataDir), 'exports');
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }

    this.textInspector = new TextInspector(this.sensitiveWordStorage.getAll());
    this.initDefaultSensitiveWords();
  }

  private initDefaultSensitiveWords() {
    if (this.sensitiveWordStorage.count() === 0) {
      const defaultWords: SensitiveWord[] = [
        { id: uuidv4(), word: '投诉', category: '负面情绪', severity: 'medium', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), word: '举报', category: '负面情绪', severity: 'medium', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), word: '不满意', category: '负面情绪', severity: 'low', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), word: '垃圾', category: '辱骂', severity: 'high', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), word: '傻逼', category: '辱骂', severity: 'high', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), word: '滚', category: '辱骂', severity: 'high', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), word: '欺骗', category: '欺诈', severity: 'high', enabled: true, createdAt: new Date().toISOString() },
        { id: uuidv4(), word: '虚假', category: '欺诈', severity: 'high', enabled: true, createdAt: new Date().toISOString() }
      ];
      this.sensitiveWordStorage.createMany(defaultWords);
      this.textInspector.updateSensitiveWords(defaultWords);
    }
  }

  importTranscriptions(records: Omit<TranscriptionRecord, 'id'>[]): InspectionRecord[] {
    const now = new Date().toISOString();
    const inspectionRecords: InspectionRecord[] = records.map(record => ({
      ...record,
      id: uuidv4(),
      status: InspectionStatus.IMPORTED,
      issues: [],
      hasApology: false,
      hasRefundPromise: false,
      createdAt: now,
      updatedAt: now
    }));

    const created = this.recordStorage.createMany(inspectionRecords);
    console.log(`[Service] Imported ${created.length} records`);
    return created;
  }

  scanRecord(recordId: string): InspectionRecord | undefined {
    const record = this.recordStorage.getById(recordId);
    if (!record) return undefined;

    if (record.status !== InspectionStatus.IMPORTED && record.status !== InspectionStatus.SCANNED) {
      throw new Error(`Record ${recordId} is in state ${record.status}, cannot scan`);
    }

    const result = this.textInspector.inspect(record.transcription);
    const now = new Date().toISOString();

    const updated = this.recordStorage.update(recordId, {
      ...result,
      status: result.issues.length > 0 ? InspectionStatus.PENDING_REVIEW : InspectionStatus.SCANNED,
      scanTime: now,
      updatedAt: now
    });

    return updated;
  }

  scanAll(): { scanned: number; withIssues: number } {
    const records = this.recordStorage.find(r => 
      r.status === InspectionStatus.IMPORTED || r.status === InspectionStatus.SCANNED
    );

    let withIssues = 0;
    for (const record of records) {
      const scanned = this.scanRecord(record.id);
      if (scanned && scanned.issues.length > 0) {
        withIssues++;
      }
    }

    return { scanned: records.length, withIssues };
  }

  getRecords(status?: InspectionStatus, maskSensitive: boolean = true): InspectionRecord[] {
    let records = this.recordStorage.getAll();
    
    if (status) {
      records = records.filter(r => r.status === status);
    }

    if (maskSensitive) {
      records = records.map(r => {
        const masked = DataMasker.maskObject(r, ['customerName', 'customerPhone', 'customerIdCard'] as const);
        return masked as InspectionRecord;
      });
    }

    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getRecordById(id: string, maskSensitive: boolean = true): InspectionRecord | undefined {
    const record = this.recordStorage.getById(id);
    if (!record) return undefined;

    if (maskSensitive) {
      return DataMasker.maskObject(record, ['customerName', 'customerPhone', 'customerIdCard'] as const) as InspectionRecord;
    }

    return record;
  }

  reviewRecord(recordId: string, request: ReviewRequest): InspectionRecord | undefined {
    const record = this.recordStorage.getById(recordId);
    if (!record) return undefined;

    if (record.status !== InspectionStatus.PENDING_REVIEW) {
      throw new Error(`Record ${recordId} is in state ${record.status}, cannot review`);
    }

    const now = new Date().toISOString();
    const newStatus = request.action === 'pass' 
      ? InspectionStatus.REVIEW_PASSED 
      : InspectionStatus.REVIEW_REJECTED;

    return this.recordStorage.update(recordId, {
      status: newStatus,
      reviewTime: now,
      reviewer: request.reviewer,
      reviewNotes: request.notes,
      updatedAt: now
    });
  }

  getSummary(): InspectionSummary {
    const allRecords = this.recordStorage.getAll();
    
    const issueBreakdown = {
      missingApology: 0,
      missingRefundPromise: 0,
      sensitiveWord: 0
    };

    const sensitiveWordCounts: Map<string, number> = new Map();

    for (const record of allRecords) {
      for (const issue of record.issues) {
        if (issue.type === IssueType.MISSING_APOLOGY) {
          issueBreakdown.missingApology++;
        } else if (issue.type === IssueType.MISSING_REFUND_PROMISE) {
          issueBreakdown.missingRefundPromise++;
        } else if (issue.type === IssueType.SENSITIVE_WORD) {
          issueBreakdown.sensitiveWord++;
          if (issue.matchedText) {
            const count = sensitiveWordCounts.get(issue.matchedText) || 0;
            sensitiveWordCounts.set(issue.matchedText, count + 1);
          }
        }
      }
    }

    const topSensitiveWords = Array.from(sensitiveWordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return {
      totalRecords: allRecords.length,
      scannedCount: allRecords.filter(r => r.scanTime).length,
      pendingReviewCount: allRecords.filter(r => r.status === InspectionStatus.PENDING_REVIEW).length,
      passedCount: allRecords.filter(r => r.status === InspectionStatus.REVIEW_PASSED).length,
      rejectedCount: allRecords.filter(r => r.status === InspectionStatus.REVIEW_REJECTED).length,
      issueBreakdown,
      topSensitiveWords
    };
  }

  async exportToCsv(status?: InspectionStatus): Promise<string> {
    let records = this.recordStorage.getAll();
    
    if (status) {
      records = records.filter(r => r.status === status);
    }

    records = records.map(r => 
      DataMasker.maskObject(r, ['customerName', 'customerPhone', 'customerIdCard'] as const) as InspectionRecord
    );

    const filename = `inspection-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    const filePath = path.join(this.exportsDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'callTime', title: '通话时间' },
        { id: 'agentName', title: '坐席姓名' },
        { id: 'agentId', title: '坐席工号' },
        { id: 'customerName', title: '客户姓名' },
        { id: 'customerPhone', title: '客户电话' },
        { id: 'status', title: '质检状态' },
        { id: 'hasApology', title: '是否有道歉' },
        { id: 'hasRefundPromise', title: '是否有退款承诺' },
        { id: 'issueCount', title: '问题数量' },
        { id: 'reviewer', title: '复核人' },
        { id: 'reviewTime', title: '复核时间' }
      ]
    });

    const csvData = records.map(r => ({
      ...r,
      issueCount: r.issues.length,
      hasApology: r.hasApology ? '是' : '否',
      hasRefundPromise: r.hasRefundPromise ? '是' : '否'
    }));

    await csvWriter.writeRecords(csvData);

    const now = new Date().toISOString();
    for (const record of records) {
      this.recordStorage.update(record.id, {
        status: InspectionStatus.EXPORTED,
        exportTime: now,
        updatedAt: now
      });
    }

    console.log(`[Service] Exported ${records.length} records to ${filename}`);
    return filePath;
  }

  addSensitiveWord(word: Omit<SensitiveWord, 'id' | 'createdAt'>): SensitiveWord {
    const newWord: SensitiveWord = {
      ...word,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    const created = this.sensitiveWordStorage.create(newWord);
    this.textInspector.updateSensitiveWords(this.sensitiveWordStorage.getAll());
    return created;
  }

  getSensitiveWords(): SensitiveWord[] {
    return this.sensitiveWordStorage.getAll();
  }

  deleteRecord(id: string): boolean {
    return this.recordStorage.delete(id);
  }

  getStats() {
    return {
      total: this.recordStorage.count(),
      sensitiveWords: this.sensitiveWordStorage.count()
    };
  }
}
