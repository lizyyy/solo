import { v4 as uuidv4 } from 'uuid';
import {
  ReadonlyWindow,
  BlockedWrite,
  WindowReport,
  ExceptionRecord,
  ManualCorrection,
  AffectedService,
  WindowStatus
} from '../types';

class MemoryStore {
  private windows: Map<string, ReadonlyWindow> = new Map();
  private blockedWrites: Map<string, BlockedWrite> = new Map();
  private reports: Map<string, WindowReport> = new Map();
  private exceptions: Map<string, ExceptionRecord> = new Map();
  private corrections: Map<string, ManualCorrection> = new Map();

  createWindow(windowData: Omit<ReadonlyWindow, 'id' | 'createdAt' | 'updatedAt'>): ReadonlyWindow {
    const id = uuidv4();
    const now = new Date();
    const window: ReadonlyWindow = {
      ...windowData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.windows.set(id, window);
    return window;
  }

  getWindow(id: string): ReadonlyWindow | undefined {
    return this.windows.get(id);
  }

  getWindows(filters?: { databaseName?: string; status?: WindowStatus }): ReadonlyWindow[] {
    let result = Array.from(this.windows.values());
    if (filters?.databaseName) {
      result = result.filter(w => w.databaseName === filters.databaseName);
    }
    if (filters?.status) {
      result = result.filter(w => w.status === filters.status);
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateWindow(id: string, updates: Partial<ReadonlyWindow>): ReadonlyWindow | undefined {
    const window = this.windows.get(id);
    if (!window) return undefined;
    const updated: ReadonlyWindow = {
      ...window,
      ...updates,
      updatedAt: new Date()
    };
    this.windows.set(id, updated);
    return updated;
  }

  deleteWindow(id: string): boolean {
    return this.windows.delete(id);
  }

  addBlockedWrite(blockedData: Omit<BlockedWrite, 'id' | 'timestamp' | 'retryCount' | 'resolved'>): BlockedWrite {
    const id = uuidv4();
    const blocked: BlockedWrite = {
      ...blockedData,
      id,
      timestamp: new Date(),
      retryCount: 0,
      resolved: false
    };
    this.blockedWrites.set(id, blocked);
    return blocked;
  }

  getBlockedWrites(windowId?: string): BlockedWrite[] {
    let result = Array.from(this.blockedWrites.values());
    if (windowId) {
      result = result.filter(b => b.windowId === windowId);
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  updateBlockedWrite(id: string, updates: Partial<BlockedWrite>): BlockedWrite | undefined {
    const blocked = this.blockedWrites.get(id);
    if (!blocked) return undefined;
    const updated = { ...blocked, ...updates };
    this.blockedWrites.set(id, updated);
    return updated;
  }

  createReport(reportData: Omit<WindowReport, 'id' | 'generatedAt'>): WindowReport {
    const id = uuidv4();
    const report: WindowReport = {
      ...reportData,
      id,
      generatedAt: new Date()
    };
    this.reports.set(id, report);
    return report;
  }

  getReports(windowId?: string): WindowReport[] {
    let result = Array.from(this.reports.values());
    if (windowId) {
      result = result.filter(r => r.windowId === windowId);
    }
    return result.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  recordException(exceptionData: Omit<ExceptionRecord, 'id' | 'timestamp' | 'handled'>): ExceptionRecord {
    const id = uuidv4();
    const exception: ExceptionRecord = {
      ...exceptionData,
      id,
      timestamp: new Date(),
      handled: false
    };
    this.exceptions.set(id, exception);
    return exception;
  }

  getExceptions(windowId?: string): ExceptionRecord[] {
    let result = Array.from(this.exceptions.values());
    if (windowId) {
      result = result.filter(e => e.windowId === windowId);
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  updateException(id: string, updates: Partial<ExceptionRecord>): ExceptionRecord | undefined {
    const exception = this.exceptions.get(id);
    if (!exception) return undefined;
    const updated = { ...exception, ...updates };
    this.exceptions.set(id, updated);
    return updated;
  }

  recordCorrection(correctionData: Omit<ManualCorrection, 'id' | 'timestamp'>): ManualCorrection {
    const id = uuidv4();
    const correction: ManualCorrection = {
      ...correctionData,
      id,
      timestamp: new Date()
    };
    this.corrections.set(id, correction);
    return correction;
  }

  getCorrections(windowId?: string): ManualCorrection[] {
    let result = Array.from(this.corrections.values());
    if (windowId) {
      result = result.filter(c => c.windowId === windowId);
    }
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getWindowStats(windowId: string): { totalBlocked: number; byService: Record<string, number> } {
    const blocked = this.getBlockedWrites(windowId);
    const byService: Record<string, number> = {};
    blocked.forEach(b => {
      byService[b.serviceName] = (byService[b.serviceName] || 0) + 1;
    });
    return {
      totalBlocked: blocked.length,
      byService
    };
  }
}

export const store = new MemoryStore();
