import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditResult,
  AuditRecord,
  ManualCorrection,
  AuditItem
} from '../types';

interface StoredData {
  records: { [contentHash: string]: AuditRecord };
  idToHash: { [id: string]: string };
  handlerIndex: { [handler: string]: string[] };
}

export class StorageService {
  private dataPath: string;
  private data: StoredData;

  constructor(dataDir: string = './data') {
    this.dataPath = path.join(dataDir, 'audit-data.json');
    this.ensureDataDir(dataDir);
    this.data = this.loadData();
  }

  private ensureDataDir(dataDir: string): void {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private loadData(): StoredData {
    if (fs.existsSync(this.dataPath)) {
      try {
        const content = fs.readFileSync(this.dataPath, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.warn('存储文件损坏，重新初始化');
      }
    }
    return {
      records: {},
      idToHash: {},
      handlerIndex: {}
    };
  }

  private saveData(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(16);
  }

  saveAuditResult(
    result: AuditResult,
    handler?: string
  ): { 
    isDuplicate: boolean; 
    isConflicting: boolean;
    existingRecord?: AuditRecord; 
    newRecord?: AuditRecord;
  } {
    const contentHash = this.hashContent(result.item.content);

    if (this.data.records[contentHash]) {
      const existingRecord = this.data.records[contentHash];
      const isConflicting = existingRecord.result.overallDecision !== result.overallDecision;
      
      return {
        isDuplicate: true,
        isConflicting,
        existingRecord
      };
    }

    const record: AuditRecord = {
      result,
      corrections: [],
      status: 'pending',
      handler,
      auditTimestamp: Date.now()
    };

    this.data.records[contentHash] = record;
    this.data.idToHash[result.itemId] = contentHash;

    if (handler) {
      if (!this.data.handlerIndex[handler]) {
        this.data.handlerIndex[handler] = [];
      }
      if (!this.data.handlerIndex[handler].includes(result.itemId)) {
        this.data.handlerIndex[handler].push(result.itemId);
      }
    }

    this.saveData();

    return { isDuplicate: false, isConflicting: false, newRecord: record };
  }

  forceUpdateAuditResult(
    result: AuditResult,
    handler?: string
  ): {
    isConflicting: boolean;
    previousRecord?: AuditRecord;
    newRecord: AuditRecord;
  } {
    const contentHash = this.hashContent(result.item.content);
    const previousRecord = this.data.records[contentHash];

    const newRecord: AuditRecord = {
      result,
      corrections: [],
      status: 'pending',
      handler,
      auditTimestamp: Date.now()
    };

    this.data.records[contentHash] = newRecord;
    this.data.idToHash[result.itemId] = contentHash;

    if (handler) {
      if (!this.data.handlerIndex[handler]) {
        this.data.handlerIndex[handler] = [];
      }
      if (!this.data.handlerIndex[handler].includes(result.itemId)) {
        this.data.handlerIndex[handler].push(result.itemId);
      }
    }

    this.saveData();

    const isConflicting = previousRecord ? previousRecord.result.overallDecision !== result.overallDecision : false;

    return {
      isConflicting,
      previousRecord,
      newRecord
    };
  }

  getRecordByItemId(itemId: string): AuditRecord | undefined {
    const hash = this.data.idToHash[itemId];
    return hash ? this.data.records[hash] : undefined;
  }

  getRecordByContent(content: string): AuditRecord | undefined {
    const hash = this.hashContent(content);
    return this.data.records[hash];
  }

  addManualCorrection(
    itemId: string,
    handler: string,
    newDecision: 'pass' | 'reject' | 'review',
    remark: string
  ): { success: boolean; record?: AuditRecord; error?: string } {
    const record = this.getRecordByItemId(itemId);
    
    if (!record) {
      return { success: false, error: '未找到对应的审核记录' };
    }

    const correction: ManualCorrection = {
      id: uuidv4(),
      resultId: itemId,
      handler,
      originalDecision: record.result.overallDecision,
      newDecision,
      remark,
      timestamp: Date.now()
    };

    record.corrections.push(correction);
    record.status = 'corrected';
    record.finalDecision = newDecision;

    const contentHash = this.data.idToHash[itemId];
    this.data.records[contentHash] = record;

    if (!this.data.handlerIndex[handler]) {
      this.data.handlerIndex[handler] = [];
    }
    if (!this.data.handlerIndex[handler].includes(itemId)) {
      this.data.handlerIndex[handler].push(itemId);
    }

    this.saveData();

    return { success: true, record };
  }

  confirmRecord(
    itemId: string,
    handler?: string
  ): { success: boolean; record?: AuditRecord; error?: string } {
    const record = this.getRecordByItemId(itemId);
    
    if (!record) {
      return { success: false, error: '未找到对应的审核记录' };
    }

    record.status = 'confirmed';
    record.finalDecision = record.result.overallDecision;
    
    if (handler) {
      record.handler = handler;
      if (!this.data.handlerIndex[handler]) {
        this.data.handlerIndex[handler] = [];
      }
      if (!this.data.handlerIndex[handler].includes(itemId)) {
        this.data.handlerIndex[handler].push(itemId);
      }
    }

    const contentHash = this.data.idToHash[itemId];
    this.data.records[contentHash] = record;
    this.saveData();

    return { success: true, record };
  }

  queryByHandler(handler: string): AuditRecord[] {
    const indexedItemIds = this.data.handlerIndex[handler] || [];
    const indexedRecords = indexedItemIds
      .map(id => this.getRecordByItemId(id))
      .filter((r): r is AuditRecord => r !== undefined);
    
    const allRecords = this.getAllRecords();
    const handlerFieldMatches = allRecords.filter(r => r.handler === handler);
    
    const mergedMap = new Map<string, AuditRecord>();
    for (const record of indexedRecords) {
      mergedMap.set(record.result.itemId, record);
    }
    for (const record of handlerFieldMatches) {
      mergedMap.set(record.result.itemId, record);
    }
    
    return Array.from(mergedMap.values());
  }

  queryByStatus(status: 'pending' | 'confirmed' | 'corrected'): AuditRecord[] {
    return Object.values(this.data.records).filter(r => r.status === status);
  }

  queryByDecision(decision: 'pass' | 'reject' | 'review'): AuditRecord[] {
    return Object.values(this.data.records).filter(r => {
      const finalDecision = r.finalDecision || r.result.overallDecision;
      return finalDecision === decision;
    });
  }

  getAllRecords(): AuditRecord[] {
    return Object.values(this.data.records);
  }

  getStats(): {
    total: number;
    pending: number;
    confirmed: number;
    corrected: number;
    pass: number;
    reject: number;
    review: number;
  } {
    const records = this.getAllRecords();
    return {
      total: records.length,
      pending: records.filter(r => r.status === 'pending').length,
      confirmed: records.filter(r => r.status === 'confirmed').length,
      corrected: records.filter(r => r.status === 'corrected').length,
      pass: records.filter(r => (r.finalDecision || r.result.overallDecision) === 'pass').length,
      reject: records.filter(r => (r.finalDecision || r.result.overallDecision) === 'reject').length,
      review: records.filter(r => (r.finalDecision || r.result.overallDecision) === 'review').length
    };
  }

  checkDuplicates(items: AuditItem[]): {
    duplicates: { item: AuditItem; existingRecord: AuditRecord }[];
    newItems: AuditItem[];
  } {
    const duplicates: { item: AuditItem; existingRecord: AuditRecord }[] = [];
    const newItems: AuditItem[] = [];

    for (const item of items) {
      const existing = this.getRecordByContent(item.content);
      if (existing) {
        duplicates.push({ item, existingRecord: existing });
      } else {
        newItems.push(item);
      }
    }

    return { duplicates, newItems };
  }
}
