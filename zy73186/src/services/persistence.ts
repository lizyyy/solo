import { openDB, IDBPDatabase } from 'idb';
import type {
  Session,
  Material,
  ComputationStep,
  AuditLog,
  SuspendedTask,
  Report,
  StoredSession,
} from '../types';
import { generateId } from '../utils/hash';

const DB_NAME = 'error-propagation-db';
const DB_VERSION = 1;
const LS_CURRENT_SESSION_KEY = 'ep_current_session';

const STORES = {
  SESSIONS: 'sessions',
  MATERIALS: 'materials',
  COMPUTATION_STEPS: 'computation_steps',
  AUDIT_LOGS: 'audit_logs',
  SUSPENDED_TASKS: 'suspended_tasks',
  REPORTS: 'reports',
} as const;

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    console.log('[Persistence] Opening IndexedDB...');
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        console.log('[Persistence] Upgrading IndexedDB...');
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          sessionStore.createIndex('createdAt', 'createdAt');
          sessionStore.createIndex('status', 'status');
          console.log('[Persistence] Created sessions store');
        }

        if (!db.objectStoreNames.contains(STORES.MATERIALS)) {
          const materialStore = db.createObjectStore(STORES.MATERIALS, { keyPath: 'id' });
          materialStore.createIndex('sessionId', 'sessionId');
          materialStore.createIndex('type', 'type');
          materialStore.createIndex('contentHash', 'contentHash');
          console.log('[Persistence] Created materials store');
        }

        if (!db.objectStoreNames.contains(STORES.COMPUTATION_STEPS)) {
          const stepStore = db.createObjectStore(STORES.COMPUTATION_STEPS, { keyPath: 'id' });
          stepStore.createIndex('sessionId', 'sessionId');
          stepStore.createIndex('stepOrder', 'stepOrder');
          console.log('[Persistence] Created computation_steps store');
        }

        if (!db.objectStoreNames.contains(STORES.AUDIT_LOGS)) {
          const logStore = db.createObjectStore(STORES.AUDIT_LOGS, { keyPath: 'id' });
          logStore.createIndex('sessionId', 'sessionId');
          logStore.createIndex('timestamp', 'timestamp');
          logStore.createIndex('actionType', 'actionType');
          console.log('[Persistence] Created audit_logs store');
        }

        if (!db.objectStoreNames.contains(STORES.SUSPENDED_TASKS)) {
          const taskStore = db.createObjectStore(STORES.SUSPENDED_TASKS, { keyPath: 'id' });
          taskStore.createIndex('sessionId', 'sessionId');
          taskStore.createIndex('status', 'status');
          taskStore.createIndex('reason', 'reason');
          console.log('[Persistence] Created suspended_tasks store');
        }

        if (!db.objectStoreNames.contains(STORES.REPORTS)) {
          const reportStore = db.createObjectStore(STORES.REPORTS, { keyPath: 'id' });
          reportStore.createIndex('sessionId', 'sessionId');
          reportStore.createIndex('createdAt', 'createdAt');
          console.log('[Persistence] Created reports store');
        }
      },
    });
    dbPromise.then(() => {
      console.log('[Persistence] IndexedDB opened successfully');
    }).catch((err) => {
      console.error('[Persistence] Failed to open IndexedDB:', err);
    });
  }
  return dbPromise;
}

export const persistenceService = {
  async saveSession(session: Session): Promise<void> {
    const db = await getDB();
    await db.put(STORES.SESSIONS, session);
    localStorage.setItem(
      LS_CURRENT_SESSION_KEY,
      JSON.stringify({ sessionId: session.id, step: session.currentStep, timestamp: Date.now() })
    );
  },

  async getSession(id: string): Promise<Session | null> {
    const db = await getDB();
    return (await db.get(STORES.SESSIONS, id)) || null;
  },

  async getAllSessions(): Promise<Session[]> {
    const db = await getDB();
    const sessions = await db.getAllFromIndex(STORES.SESSIONS, 'createdAt');
    return sessions.reverse();
  },

  async deleteSession(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(
      [STORES.SESSIONS, STORES.MATERIALS, STORES.COMPUTATION_STEPS, STORES.AUDIT_LOGS, STORES.SUSPENDED_TASKS, STORES.REPORTS],
      'readwrite'
    );

    await tx.objectStore(STORES.SESSIONS).delete(id);
    await tx.objectStore(STORES.MATERIALS).delete(IDBKeyRange.only(id));
    await tx.objectStore(STORES.COMPUTATION_STEPS).delete(IDBKeyRange.only(id));
    await tx.objectStore(STORES.AUDIT_LOGS).delete(IDBKeyRange.only(id));
    await tx.objectStore(STORES.SUSPENDED_TASKS).delete(IDBKeyRange.only(id));
    await tx.objectStore(STORES.REPORTS).delete(IDBKeyRange.only(id));

    await tx.done;

    const current = localStorage.getItem(LS_CURRENT_SESSION_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      if (parsed.sessionId === id) {
        localStorage.removeItem(LS_CURRENT_SESSION_KEY);
      }
    }
  },

  async saveMaterial(material: Material): Promise<void> {
    const db = await getDB();
    await db.put(STORES.MATERIALS, material);
  },

  async getMaterial(id: string): Promise<Material | null> {
    const db = await getDB();
    return (await db.get(STORES.MATERIALS, id)) || null;
  },

  async getMaterialsBySession(sessionId: string): Promise<Material[]> {
    const db = await getDB();
    return (await db.getAllFromIndex(STORES.MATERIALS, 'sessionId', sessionId)).sort(
      (a, b) => a.version - b.version
    );
  },

  async getAllMaterials(): Promise<Material[]> {
    const db = await getDB();
    return db.getAll(STORES.MATERIALS);
  },

  async saveComputationStep(step: ComputationStep): Promise<void> {
    const db = await getDB();
    await db.put(STORES.COMPUTATION_STEPS, step);
  },

  async getComputationStepsBySession(sessionId: string): Promise<ComputationStep[]> {
    const db = await getDB();
    return (await db.getAllFromIndex(STORES.COMPUTATION_STEPS, 'sessionId', sessionId)).sort(
      (a, b) => a.stepOrder - b.stepOrder
    );
  },

  async saveAuditLog(log: AuditLog): Promise<void> {
    const db = await getDB();
    await db.put(STORES.AUDIT_LOGS, log);
  },

  async getAuditLogsBySession(sessionId: string): Promise<AuditLog[]> {
    const db = await getDB();
    return (await db.getAllFromIndex(STORES.AUDIT_LOGS, 'sessionId', sessionId)).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  },

  async saveSuspendedTask(task: SuspendedTask): Promise<void> {
    const db = await getDB();
    await db.put(STORES.SUSPENDED_TASKS, task);
  },

  async getSuspendedTasks(): Promise<SuspendedTask[]> {
    const db = await getDB();
    const tasks = await db.getAllFromIndex(STORES.SUSPENDED_TASKS, 'createdAt');
    return tasks.reverse();
  },

  async getSuspendedTasksBySession(sessionId: string): Promise<SuspendedTask[]> {
    const db = await getDB();
    return db.getAllFromIndex(STORES.SUSPENDED_TASKS, 'sessionId', sessionId);
  },

  async getPendingSuspendedTasks(): Promise<SuspendedTask[]> {
    const db = await getDB();
    return db.getAllFromIndex(STORES.SUSPENDED_TASKS, 'status', 'pending');
  },

  async saveReport(report: Report): Promise<void> {
    const db = await getDB();
    await db.put(STORES.REPORTS, report);
  },

  async getReport(id: string): Promise<Report | null> {
    const db = await getDB();
    return (await db.get(STORES.REPORTS, id)) || null;
  },

  async getReportsBySession(sessionId: string): Promise<Report[]> {
    const db = await getDB();
    return (await db.getAllFromIndex(STORES.REPORTS, 'sessionId', sessionId)).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  },

  async getCurrentProgress(): Promise<{ sessionId: string; step: number } | null> {
    const current = localStorage.getItem(LS_CURRENT_SESSION_KEY);
    if (!current) return null;

    try {
      const parsed = JSON.parse(current);
      const session = await this.getSession(parsed.sessionId);
      if (!session || session.status === 'completed') {
        localStorage.removeItem(LS_CURRENT_SESSION_KEY);
        return null;
      }
      return { sessionId: parsed.sessionId, step: parsed.step };
    } catch {
      localStorage.removeItem(LS_CURRENT_SESSION_KEY);
      return null;
    }
  },

  async getFullSession(sessionId: string): Promise<StoredSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const [materials, computationSteps, auditLogs, suspendedTasks, reports] = await Promise.all([
      this.getMaterialsBySession(sessionId),
      this.getComputationStepsBySession(sessionId),
      this.getAuditLogsBySession(sessionId),
      this.getSuspendedTasksBySession(sessionId),
      this.getReportsBySession(sessionId),
    ]);

    return {
      session,
      materials,
      computationSteps,
      auditLogs,
      suspendedTasks,
      report: reports[0],
    };
  },

  async saveFullSession(data: StoredSession): Promise<void> {
    console.log('[Persistence] saveFullSession starting, sessionId=', data.session.id);
    
    try {
      console.log('[Persistence] saving session');
      await this.saveSession(data.session);
      console.log('[Persistence] session saved');
      
      console.log('[Persistence] saving', data.materials.length, 'materials');
      await Promise.all(data.materials.map(m => this.saveMaterial(m)));
      console.log('[Persistence] materials saved');
      
      console.log('[Persistence] saving', data.computationSteps.length, 'computation steps');
      await Promise.all(data.computationSteps.map(s => this.saveComputationStep(s)));
      console.log('[Persistence] computation steps saved');
      
      console.log('[Persistence] saving', data.auditLogs.length, 'audit logs');
      await Promise.all(data.auditLogs.map(l => this.saveAuditLog(l)));
      console.log('[Persistence] audit logs saved');
      
      console.log('[Persistence] saving', data.suspendedTasks.length, 'suspended tasks');
      await Promise.all(data.suspendedTasks.map(t => this.saveSuspendedTask(t)));
      console.log('[Persistence] suspended tasks saved');
      
      if (data.report) {
        console.log('[Persistence] saving report');
        await this.saveReport(data.report);
        console.log('[Persistence] report saved');
      }
      
      console.log('[Persistence] saveFullSession COMPLETED');
    } catch (err) {
      console.error('[Persistence] saveFullSession FAILED:', err?.stack || err);
      throw err;
    }
  },

  async createNewSession(title?: string): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: generateId(),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      progress: {
        currentStep: 0,
        expandedSteps: [],
      },
      title,
    };

    await this.saveSession(session);
    return session;
  },

  async clearAll(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(
      [STORES.SESSIONS, STORES.MATERIALS, STORES.COMPUTATION_STEPS, STORES.AUDIT_LOGS, STORES.SUSPENDED_TASKS, STORES.REPORTS],
      'readwrite'
    );

    await Promise.all([
      tx.objectStore(STORES.SESSIONS).clear(),
      tx.objectStore(STORES.MATERIALS).clear(),
      tx.objectStore(STORES.COMPUTATION_STEPS).clear(),
      tx.objectStore(STORES.AUDIT_LOGS).clear(),
      tx.objectStore(STORES.SUSPENDED_TASKS).clear(),
      tx.objectStore(STORES.REPORTS).clear(),
    ]);

    await tx.done;
    localStorage.removeItem(LS_CURRENT_SESSION_KEY);
  },

  async exportSession(sessionId: string): Promise<string> {
    const data = await this.getFullSession(sessionId);
    if (!data) throw new Error('Session not found');
    return JSON.stringify(data, null, 2);
  },

  async importSession(jsonData: string): Promise<StoredSession> {
    const data: StoredSession = JSON.parse(jsonData);
    data.session.id = generateId();
    data.session.createdAt = Date.now();
    data.session.updatedAt = Date.now();

    const newId = data.session.id;
    data.materials.forEach((m) => {
      m.id = generateId();
      m.sessionId = newId;
    });
    data.computationSteps.forEach((s) => {
      s.id = generateId();
      s.sessionId = newId;
    });
    data.auditLogs.forEach((l) => {
      l.id = generateId();
      l.sessionId = newId;
    });
    data.suspendedTasks.forEach((t) => {
      t.id = generateId();
      t.sessionId = newId;
    });
    if (data.report) {
      data.report.id = generateId();
      data.report.sessionId = newId;
    }

    await this.saveFullSession(data);
    return data;
  },
};
