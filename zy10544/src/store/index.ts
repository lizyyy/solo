import { v4 as uuidv4 } from 'uuid';
import {
  ActivityStockLock,
  ReleaseRecord,
  ExceptionDetail,
  ReleaseReport,
  LockStatus,
} from '../types';

class DataStore {
  private locks: Map<string, ActivityStockLock> = new Map();
  private releaseRecords: Map<string, ReleaseRecord> = new Map();
  private exceptions: Map<string, ExceptionDetail> = new Map();
  private reports: Map<string, ReleaseReport> = new Map();
  private requestIdMap: Map<string, string> = new Map();

  generateId(): string {
    return uuidv4();
  }

  saveLock(lock: ActivityStockLock): void {
    this.locks.set(lock.id, lock);
  }

  getLock(id: string): ActivityStockLock | undefined {
    return this.locks.get(id);
  }

  getLocksByActivity(activityId: string): ActivityStockLock[] {
    return Array.from(this.locks.values()).filter(
      (lock) => lock.activityId === activityId
    );
  }

  getLocksByActivityAndSkus(activityId: string, skus: string[]): ActivityStockLock[] {
    return Array.from(this.locks.values()).filter(
      (lock) => lock.activityId === activityId && skus.includes(lock.sku)
    );
  }

  getAllLocks(): ActivityStockLock[] {
    return Array.from(this.locks.values());
  }

  saveReleaseRecord(record: ReleaseRecord): void {
    this.releaseRecords.set(record.id, record);
  }

  getReleaseRecordsByLockId(lockId: string): ReleaseRecord[] {
    return Array.from(this.releaseRecords.values()).filter(
      (r) => r.lockId === lockId
    );
  }

  saveException(exception: ExceptionDetail): void {
    this.exceptions.set(exception.id, exception);
  }

  getException(id: string): ExceptionDetail | undefined {
    return this.exceptions.get(id);
  }

  getExceptionsByActivity(activityId: string): ExceptionDetail[] {
    return Array.from(this.exceptions.values()).filter(
      (e) => e.activityId === activityId
    );
  }

  getAllExceptions(): ExceptionDetail[] {
    return Array.from(this.exceptions.values());
  }

  saveReport(report: ReleaseReport): void {
    this.reports.set(report.id, report);
  }

  getReport(id: string): ReleaseReport | undefined {
    return this.reports.get(id);
  }

  getReportsByActivity(activityId: string): ReleaseReport[] {
    return Array.from(this.reports.values()).filter(
      (r) => r.activityId === activityId
    );
  }

  getAllReports(): ReleaseReport[] {
    return Array.from(this.reports.values());
  }

  getIdempotentResult(requestId: string): string | undefined {
    return this.requestIdMap.get(requestId);
  }

  saveIdempotentResult(requestId: string, lockId: string): void {
    this.requestIdMap.set(requestId, lockId);
  }

  validateSkuExists(sku: string): boolean {
    return true;
  }
}

export const dataStore = new DataStore();
