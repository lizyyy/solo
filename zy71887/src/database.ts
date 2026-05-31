import fs from 'fs';
import path from 'path';
import {
  CollisionRecord,
  HistoryEntry,
  ImportBatch,
  CalibrationTable,
  FilterCriteria,
  GradingRecord
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

export class Database {
  private records: Map<string, CollisionRecord> = new Map();
  private history: HistoryEntry[] = [];
  private batches: ImportBatch[] = [];
  private calibration: CalibrationTable | null = null;

  constructor() {
    this.ensureDataDir();
    this.loadAll();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadAll(): void {
    this.loadRecords();
    this.loadHistory();
    this.loadBatches();
    this.loadCalibration();
  }

  private loadRecords(): void {
    const recordsPath = path.join(DATA_DIR, 'records.json');
    if (fs.existsSync(recordsPath)) {
      const data = JSON.parse(fs.readFileSync(recordsPath, 'utf-8'));
      this.records = new Map(data.map((r: CollisionRecord) => [r.id, r]));
    }
  }

  private loadHistory(): void {
    const historyPath = path.join(DATA_DIR, 'history.json');
    if (fs.existsSync(historyPath)) {
      this.history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  }

  private loadBatches(): void {
    const batchesPath = path.join(DATA_DIR, 'batches.json');
    if (fs.existsSync(batchesPath)) {
      this.batches = JSON.parse(fs.readFileSync(batchesPath, 'utf-8'));
    }
  }

  private loadCalibration(): void {
    const calPath = path.join(DATA_DIR, 'calibration.json');
    if (fs.existsSync(calPath)) {
      this.calibration = JSON.parse(fs.readFileSync(calPath, 'utf-8'));
    }
  }

  private saveRecords(): void {
    const recordsPath = path.join(DATA_DIR, 'records.json');
    fs.writeFileSync(recordsPath, JSON.stringify(Array.from(this.records.values()), null, 2), 'utf-8');
  }

  private saveHistory(): void {
    const historyPath = path.join(DATA_DIR, 'history.json');
    fs.writeFileSync(historyPath, JSON.stringify(this.history, null, 2), 'utf-8');
  }

  private saveBatches(): void {
    const batchesPath = path.join(DATA_DIR, 'batches.json');
    fs.writeFileSync(batchesPath, JSON.stringify(this.batches, null, 2), 'utf-8');
  }

  saveCalibration(calibration: CalibrationTable): void {
    this.calibration = calibration;
    const calPath = path.join(DATA_DIR, 'calibration.json');
    fs.writeFileSync(calPath, JSON.stringify(calibration, null, 2), 'utf-8');
  }

  getCalibration(): CalibrationTable | null {
    return this.calibration;
  }

  addRecord(record: CollisionRecord, operator: string, reason?: string): void {
    const existing = this.records.get(record.id);
    
    if (existing) {
      const changes = this.compareRecords(existing, record);
      if (changes.length > 0) {
        this.addHistoryEntry({
          id: this.generateId(),
          recordId: record.id,
          action: 'update',
          timestamp: new Date().toISOString(),
          operator,
          changes,
          reason
        });
      }
    } else {
      this.addHistoryEntry({
        id: this.generateId(),
        recordId: record.id,
        action: 'import',
        timestamp: new Date().toISOString(),
        operator,
        changes: [{ field: 'record', oldValue: null, newValue: record.id }],
        reason
      });
    }

    this.records.set(record.id, record);
    this.saveRecords();
  }

  private compareRecords(oldRecord: CollisionRecord, newRecord: CollisionRecord): { field: string; oldValue: any; newValue: any }[] {
    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    
    const compareObject = (oldObj: any, newObj: any, prefix: string = '') => {
      const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
      for (const key of allKeys) {
        const field = prefix ? `${prefix}.${key}` : key;
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];
        
        if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
          compareObject(oldVal, newVal, field);
        } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes.push({ field, oldValue: oldVal, newValue: newVal });
        }
      }
    };

    compareObject(oldRecord.rawData, newRecord.rawData, 'rawData');
    compareObject(oldRecord.student, newRecord.student, 'student');
    
    return changes;
  }

  private addHistoryEntry(entry: HistoryEntry): void {
    this.history.push(entry);
    this.saveHistory();
  }

  getRecord(id: string): CollisionRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): CollisionRecord[] {
    return Array.from(this.records.values());
  }

  filterRecords(criteria: FilterCriteria): CollisionRecord[] {
    return this.getAllRecords().filter(record => {
      if (criteria.studentId && !record.student.studentId.includes(criteria.studentId)) return false;
      if (criteria.studentName && !record.student.studentName.includes(criteria.studentName)) return false;
      if (criteria.groupId && record.student.groupId !== criteria.groupId) return false;
      if (criteria.experimentDateFrom && record.student.experimentDate < criteria.experimentDateFrom) return false;
      if (criteria.experimentDateTo && record.student.experimentDate > criteria.experimentDateTo) return false;
      if (criteria.status?.length && !criteria.status.includes(record.status)) return false;
      if (criteria.hasAnomalies !== undefined) {
        const hasAnomalies = record.anomalies.length > 0;
        if (criteria.hasAnomalies !== hasAnomalies) return false;
      }
      if (criteria.anomalyTypes?.length) {
        const hasType = record.anomalies.some(a => criteria.anomalyTypes!.includes(a.type));
        if (!hasType) return false;
      }
      if (criteria.minScore !== undefined && (!record.grading || record.grading.score < criteria.minScore)) return false;
      if (criteria.maxScore !== undefined && (record.grading && record.grading.score > criteria.maxScore)) return false;
      if (criteria.importBatchId && record.importBatchId !== criteria.importBatchId) return false;
      return true;
    });
  }

  addBatch(batch: ImportBatch): void {
    this.batches.push(batch);
    this.saveBatches();
  }

  getBatches(): ImportBatch[] {
    return this.batches;
  }

  getBatch(id: string): ImportBatch | undefined {
    return this.batches.find(b => b.id === id);
  }

  rollbackBatch(batchId: string, operator: string, reason: string): void {
    const batch = this.batches.find(b => b.id === batchId);
    if (!batch) throw new Error(`批次 ${batchId} 不存在`);

    const recordsToRollback = this.getAllRecords().filter(r => r.importBatchId === batchId);
    for (const record of recordsToRollback) {
      this.records.delete(record.id);
      this.addHistoryEntry({
        id: this.generateId(),
        recordId: record.id,
        action: 'withdraw',
        timestamp: new Date().toISOString(),
        operator,
        changes: [{ field: 'status', oldValue: record.status, newValue: 'withdrawn' }],
        reason
      });
    }

    batch.status = 'rolled_back';
    batch.rollbackReason = reason;
    this.saveRecords();
    this.saveBatches();
  }

  gradeRecord(recordId: string, grading: GradingRecord, operator: string): void {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`记录 ${recordId} 不存在`);

    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    if (record.grading) {
      if (record.grading.score !== grading.score) {
        changes.push({ field: 'grading.score', oldValue: record.grading.score, newValue: grading.score });
      }
      if (record.grading.comments !== grading.comments) {
        changes.push({ field: 'grading.comments', oldValue: record.grading.comments, newValue: grading.comments });
      }
    } else {
      changes.push({ field: 'grading', oldValue: null, newValue: 'added' });
    }

    if (changes.length > 0) {
      this.addHistoryEntry({
        id: this.generateId(),
        recordId,
        action: 'grade',
        timestamp: new Date().toISOString(),
        operator,
        changes
      });
    }

    if (record.grading) {
      grading.previousScore = record.grading.score;
      grading.previousComments = record.grading.comments;
    }

    record.grading = grading;
    record.status = 'graded';
    record.updatedAt = new Date().toISOString();
    record.version++;
    this.saveRecords();
  }

  getRecordHistory(recordId: string): HistoryEntry[] {
    return this.history.filter(h => h.recordId === recordId).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getAllHistory(): HistoryEntry[] {
    return this.history.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  updateRecordStatus(recordId: string, status: CollisionRecord['status'], operator: string, reason?: string): void {
    const record = this.records.get(recordId);
    if (!record) throw new Error(`记录 ${recordId} 不存在`);

    if (record.status !== status) {
      this.addHistoryEntry({
        id: this.generateId(),
        recordId,
        action: status === 'withdrawn' ? 'withdraw' : 'update',
        timestamp: new Date().toISOString(),
        operator,
        changes: [{ field: 'status', oldValue: record.status, newValue: status }],
        reason
      });
      record.status = status;
      record.updatedAt = new Date().toISOString();
      record.version++;
      this.saveRecords();
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getDataDir(): string {
    return DATA_DIR;
  }
}
