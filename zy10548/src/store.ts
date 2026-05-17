import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  SyncTask,
  PauseWindow,
  RecoveryAction,
  FailureDetail,
  SyncReport,
  BacklogStats
} from './models';

interface DataStore {
  syncTasks: Map<string, SyncTask>;
  pauseWindows: Map<string, PauseWindow>;
  recoveryActions: Map<string, RecoveryAction>;
  failureDetails: Map<string, FailureDetail>;
  syncReports: Map<string, SyncReport>;
}

export class PersistentStore {
  private dataPath: string;
  private store: DataStore;

  constructor(dataDir: string = './data') {
    this.dataPath = path.resolve(dataDir);
    this.ensureDataDir();
    this.store = this.loadStore();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  private loadStore(): DataStore {
    const files = ['syncTasks', 'pauseWindows', 'recoveryActions', 'failureDetails', 'syncReports'];
    const store: DataStore = {
      syncTasks: new Map(),
      pauseWindows: new Map(),
      recoveryActions: new Map(),
      failureDetails: new Map(),
      syncReports: new Map()
    };

    for (const file of files) {
      const filePath = path.join(this.dataPath, `${file}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const mapKey = file as keyof DataStore;
          for (const [key, value] of Object.entries(data)) {
            store[mapKey].set(key, value as any);
          }
        } catch (e) {
          console.warn(`Failed to load ${file}, starting fresh`);
        }
      }
    }

    return store;
  }

  private saveStore(): void {
    const files: Array<{ key: keyof DataStore; file: string }> = [
      { key: 'syncTasks', file: 'syncTasks' },
      { key: 'pauseWindows', file: 'pauseWindows' },
      { key: 'recoveryActions', file: 'recoveryActions' },
      { key: 'failureDetails', file: 'failureDetails' },
      { key: 'syncReports', file: 'syncReports' }
    ];

    for (const { key, file } of files) {
      const filePath = path.join(this.dataPath, `${file}.json`);
      const obj = Object.fromEntries(this.store[key].entries());
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf-8');
    }
  }

  generateId(): string {
    return uuidv4();
  }

  getNow(): string {
    return new Date().toISOString();
  }

  createSyncTask(task: Omit<SyncTask, 'id' | 'createdAt' | 'updatedAt'>): SyncTask {
    const id = this.generateId();
    const now = this.getNow();
    const newTask: SyncTask = {
      ...task,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.store.syncTasks.set(id, newTask);
    this.saveStore();
    return newTask;
  }

  getSyncTask(id: string): SyncTask | undefined {
    return this.store.syncTasks.get(id);
  }

  listSyncTasks(): SyncTask[] {
    return Array.from(this.store.syncTasks.values());
  }

  updateSyncTask(id: string, updates: Partial<SyncTask>): SyncTask | undefined {
    const task = this.store.syncTasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates, updatedAt: this.getNow() };
    this.store.syncTasks.set(id, updated);
    this.saveStore();
    return updated;
  }

  createPauseWindow(window: Omit<PauseWindow, 'id' | 'createdAt' | 'updatedAt'>): PauseWindow {
    const id = this.generateId();
    const now = this.getNow();
    const newWindow: PauseWindow = {
      ...window,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.store.pauseWindows.set(id, newWindow);
    this.saveStore();
    return newWindow;
  }

  getPauseWindow(id: string): PauseWindow | undefined {
    return this.store.pauseWindows.get(id);
  }

  listPauseWindowsByTask(syncTaskId: string): PauseWindow[] {
    return Array.from(this.store.pauseWindows.values())
      .filter(w => w.syncTaskId === syncTaskId);
  }

  updatePauseWindow(id: string, updates: Partial<PauseWindow>): PauseWindow | undefined {
    const window = this.store.pauseWindows.get(id);
    if (!window) return undefined;
    const updated = { ...window, ...updates, updatedAt: this.getNow() };
    this.store.pauseWindows.set(id, updated);
    this.saveStore();
    return updated;
  }

  createRecoveryAction(action: Omit<RecoveryAction, 'id' | 'createdAt' | 'updatedAt'>): RecoveryAction {
    const id = this.generateId();
    const now = this.getNow();
    const newAction: RecoveryAction = {
      ...action,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.store.recoveryActions.set(id, newAction);
    this.saveStore();
    return newAction;
  }

  getRecoveryAction(id: string): RecoveryAction | undefined {
    return this.store.recoveryActions.get(id);
  }

  getRecoveryActionByIdempotencyKey(key: string): RecoveryAction | undefined {
    return Array.from(this.store.recoveryActions.values())
      .find(a => a.idempotencyKey === key);
  }

  listRecoveryActionsByTask(syncTaskId: string): RecoveryAction[] {
    return Array.from(this.store.recoveryActions.values())
      .filter(a => a.syncTaskId === syncTaskId);
  }

  updateRecoveryAction(id: string, updates: Partial<RecoveryAction>): RecoveryAction | undefined {
    const action = this.store.recoveryActions.get(id);
    if (!action) return undefined;
    const updated = { ...action, ...updates, updatedAt: this.getNow() };
    this.store.recoveryActions.set(id, updated);
    this.saveStore();
    return updated;
  }

  createFailureDetail(failure: Omit<FailureDetail, 'id' | 'timestamp'>): FailureDetail {
    const id = this.generateId();
    const now = this.getNow();
    const newFailure: FailureDetail = {
      ...failure,
      id,
      timestamp: now
    };
    this.store.failureDetails.set(id, newFailure);
    this.saveStore();
    return newFailure;
  }

  getFailureDetail(id: string): FailureDetail | undefined {
    return this.store.failureDetails.get(id);
  }

  listFailureDetailsByTask(syncTaskId: string): FailureDetail[] {
    return Array.from(this.store.failureDetails.values())
      .filter(f => f.syncTaskId === syncTaskId);
  }

  listFailureDetailsByRecovery(recoveryActionId: string): FailureDetail[] {
    return Array.from(this.store.failureDetails.values())
      .filter(f => f.recoveryActionId === recoveryActionId);
  }

  updateFailureDetail(id: string, updates: Partial<FailureDetail>): FailureDetail | undefined {
    const failure = this.store.failureDetails.get(id);
    if (!failure) return undefined;
    const updated = { ...failure, ...updates };
    this.store.failureDetails.set(id, updated);
    this.saveStore();
    return updated;
  }

  createSyncReport(report: Omit<SyncReport, 'id' | 'generatedAt'>): SyncReport {
    const id = this.generateId();
    const now = this.getNow();
    const newReport: SyncReport = {
      ...report,
      id,
      generatedAt: now
    };
    this.store.syncReports.set(id, newReport);
    this.saveStore();
    return newReport;
  }

  getSyncReport(id: string): SyncReport | undefined {
    return this.store.syncReports.get(id);
  }

  listSyncReportsByTask(syncTaskId: string): SyncReport[] {
    return Array.from(this.store.syncReports.values())
      .filter(r => r.syncTaskId === syncTaskId);
  }

  updateSyncReport(id: string, updates: Partial<SyncReport>): SyncReport | undefined {
    const report = this.store.syncReports.get(id);
    if (!report) return undefined;
    const updated = { ...report, ...updates };
    this.store.syncReports.set(id, updated);
    this.saveStore();
    return updated;
  }

  updateBacklogStats(syncTaskId: string, stats: Partial<BacklogStats>): SyncTask | undefined {
    const task = this.store.syncTasks.get(syncTaskId);
    if (!task) return undefined;
    const updatedStats = { ...task.backlogStats, ...stats, lastUpdated: this.getNow() };
    return this.updateSyncTask(syncTaskId, { backlogStats: updatedStats });
  }
}

export const store = new PersistentStore();
