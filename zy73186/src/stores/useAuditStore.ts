import { create } from 'zustand';
import type { AuditLog, SuspendedTask, Session } from '../types';
import { persistenceService } from '../services/persistence';
import { auditLogger as auditLogService } from '../services/auditLogger';
import { duplicateDetectionService } from '../services/duplicateDetection';

interface AuditState {
  logs: AuditLog[];
  auditLogs: AuditLog[];
  suspendedTasks: SuspendedTask[];
  isLoading: boolean;
  error: string | null;

  loadLogs: (sessionId: string) => Promise<void>;
  loadAllAuditLogs: () => Promise<void>;
  loadSuspendedTasks: () => Promise<void>;
  loadAllSuspendedTasks: () => Promise<void>;
  loadPendingSuspendedTasks: () => Promise<void>;
  addLog: (log: AuditLog) => Promise<void>;
  createSuspendedTask: (
    sessionId: string,
    reason: 'duplicate_sample' | 'caliber_change',
    duplicateInfo?: Parameters<typeof duplicateDetectionService.createSuspendedTask>[2]
  ) => Promise<SuspendedTask>;
  resolveSuspendedTask: (
    taskId: string,
    resolution: 'confirmed' | 'rejected',
    resolvedBy: string,
    resolutionNote?: string,
    action?: 'continue' | 'reject' | 'new_session'
  ) => Promise<void>;
  hasManualEdits: () => boolean;
  getManualEditCount: () => number;
  clearLogs: () => void;
  clearError: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  logs: [],
  auditLogs: [],
  suspendedTasks: [],
  isLoading: false,
  error: null,

  loadLogs: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const logs = await persistenceService.getAuditLogsBySession(sessionId);
      set({ logs, auditLogs: logs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllAuditLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const allLogs: AuditLog[] = [];
      const sessionsPromise = Promise.race([
        persistenceService.getAllSessions(),
        new Promise<Session[]>((_, reject) => setTimeout(() => reject(new Error('getAllSessions timeout')), 5000)),
      ]);
      const sessions = await sessionsPromise;
      for (const session of sessions) {
        const sessionLogsPromise = Promise.race([
          persistenceService.getAuditLogsBySession(session.id),
          new Promise<AuditLog[]>((_, reject) => setTimeout(() => reject(new Error('getAuditLogsBySession timeout')), 5000)),
        ]);
        const sessionLogs = await sessionLogsPromise;
        allLogs.push(...sessionLogs);
      }
      if (allLogs.length > 0) {
        set({ logs: allLogs, auditLogs: allLogs, isLoading: false });
      } else {
        try {
          const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
          if (lsBackup) {
            const backup = JSON.parse(lsBackup);
            if (backup.auditLogs && backup.auditLogs.length > 0) {
              set({ logs: backup.auditLogs, auditLogs: backup.auditLogs, isLoading: false });
              return;
            }
          }
        } catch (e) {
          console.warn('[AuditStore] Failed to load from localStorage backup:', e);
        }
        const { logs: currentLogs } = get();
        set({ logs: currentLogs, auditLogs: currentLogs, isLoading: false });
      }
    } catch (error) {
      console.warn('[AuditStore] loadAllAuditLogs failed:', error);
      const { logs: hydratedLogs } = get();
      if (hydratedLogs && hydratedLogs.length > 0) {
        console.log('[AuditStore] Store already has hydrated logs, keeping:', hydratedLogs.length);
        set({ error: (error as Error).message, isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.auditLogs && backup.auditLogs.length > 0) {
            console.log('[AuditStore] Falling back to localStorage logs:', backup.auditLogs.length);
            set({ logs: backup.auditLogs, auditLogs: backup.auditLogs, isLoading: false, error: (error as Error).message });
            return;
          }
        }
      } catch (e) {
        console.warn('[AuditStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadSuspendedTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasksPromise = Promise.race([
        persistenceService.getSuspendedTasks(),
        new Promise<SuspendedTask[]>((_, reject) => setTimeout(() => reject(new Error('getSuspendedTasks timeout')), 5000)),
      ]);
      const tasks = await tasksPromise;
      if (tasks && tasks.length > 0) {
        set({ suspendedTasks: tasks, isLoading: false });
      } else {
        try {
          const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
          if (lsBackup) {
            const backup = JSON.parse(lsBackup);
            if (backup.suspendedTasks && backup.suspendedTasks.length > 0) {
              set({ suspendedTasks: backup.suspendedTasks, isLoading: false });
              return;
            }
          }
        } catch (e) {
          console.warn('[AuditStore] Failed to load from localStorage backup:', e);
        }
        const { suspendedTasks: currentTasks } = get();
        set({ suspendedTasks: currentTasks, isLoading: false });
      }
    } catch (error) {
      console.warn('[AuditStore] loadSuspendedTasks failed:', error);
      const { suspendedTasks: hydratedTasks } = get();
      if (hydratedTasks && hydratedTasks.length > 0) {
        console.log('[AuditStore] Store already has hydrated tasks, keeping:', hydratedTasks.length);
        set({ error: (error as Error).message, isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.suspendedTasks && backup.suspendedTasks.length > 0) {
            console.log('[AuditStore] Falling back to localStorage tasks:', backup.suspendedTasks.length);
            set({ suspendedTasks: backup.suspendedTasks, isLoading: false, error: (error as Error).message });
            return;
          }
        }
      } catch (e) {
        console.warn('[AuditStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllSuspendedTasks: async () => {
    await get().loadSuspendedTasks();
  },

  loadPendingSuspendedTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasksPromise = Promise.race([
        persistenceService.getPendingSuspendedTasks(),
        new Promise<SuspendedTask[]>((_, reject) => setTimeout(() => reject(new Error('getPendingSuspendedTasks timeout')), 5000)),
      ]);
      const tasks = await tasksPromise;
      if (tasks && tasks.length > 0) {
        set({ suspendedTasks: tasks, isLoading: false });
      } else {
        try {
          const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
          if (lsBackup) {
            const backup = JSON.parse(lsBackup);
            if (backup.suspendedTasks && backup.suspendedTasks.length > 0) {
              const pending = backup.suspendedTasks.filter((t: SuspendedTask) => t.status === 'pending');
              if (pending.length > 0) {
                set({ suspendedTasks: pending, isLoading: false });
                return;
              }
            }
          }
        } catch (e) {
          console.warn('[AuditStore] Failed to load from localStorage backup:', e);
        }
        const { suspendedTasks: currentTasks } = get();
        set({ suspendedTasks: currentTasks, isLoading: false });
      }
    } catch (error) {
      console.warn('[AuditStore] loadPendingSuspendedTasks failed:', error);
      const { suspendedTasks: hydratedTasks } = get();
      if (hydratedTasks && hydratedTasks.length > 0) {
        const pending = hydratedTasks.filter((t) => t.status === 'pending');
        console.log('[AuditStore] Store already has hydrated tasks, keeping pending:', pending.length);
        set({ suspendedTasks: pending, error: (error as Error).message, isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.suspendedTasks && backup.suspendedTasks.length > 0) {
            const pending = backup.suspendedTasks.filter((t: SuspendedTask) => t.status === 'pending');
            if (pending.length > 0) {
              console.log('[AuditStore] Falling back to localStorage pending tasks:', pending.length);
              set({ suspendedTasks: pending, isLoading: false, error: (error as Error).message });
              return;
            }
          }
        }
      } catch (e) {
        console.warn('[AuditStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addLog: async (log: AuditLog) => {
    try {
      await persistenceService.saveAuditLog(log);
      set((state) => ({
        logs: [...state.logs, log],
        auditLogs: [...state.logs, log],
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createSuspendedTask: async (sessionId, reason, duplicateInfo) => {
    set({ isLoading: true, error: null });
    try {
      const task = await duplicateDetectionService.createSuspendedTask(
        sessionId,
        reason,
        duplicateInfo
      );
      await persistenceService.saveSuspendedTask(task);

      const log = auditLogService.logSuspend(
        sessionId,
        reason === 'duplicate_sample' ? '检测到重复样本' : '检测到口径变更'
      );
      await persistenceService.saveAuditLog(log);

      set((state) => ({
        suspendedTasks: [task, ...state.suspendedTasks],
        isLoading: false,
      }));

      return task;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  resolveSuspendedTask: async (taskId, resolution, resolvedBy, resolutionNote, action) => {
    const { suspendedTasks } = get();
    const taskIndex = suspendedTasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      set({ error: '挂起任务不存在' });
      return;
    }

    const task = suspendedTasks[taskIndex];
    const resolvedTask = duplicateDetectionService.resolveSuspendedTask(
      task,
      resolution,
      resolvedBy,
      resolutionNote
    );

    resolvedTask.resolution = {
      action: action || (resolution === 'confirmed' ? 'continue' : 'reject'),
      resolvedBy,
      resolvedAt: Date.now(),
      notes: resolutionNote || '',
    };

    set({ isLoading: true, error: null });
    try {
      await persistenceService.saveSuspendedTask(resolvedTask);

      const log =
        resolution === 'confirmed'
          ? auditLogService.logConfirm(task.sessionId, taskId, resolutionNote, resolvedBy)
          : auditLogService.logReject(task.sessionId, taskId, resolutionNote || '', resolvedBy);
      log.diff = {
        before: { status: task.status, resolution: null },
        after: { status: resolvedTask.status, resolution: resolvedTask.resolution },
        changeSummary: [
          {
            field: 'status',
            oldValue: task.status,
            newValue: resolvedTask.status,
          },
          {
            field: 'resolution',
            oldValue: null,
            newValue: resolvedTask.resolution,
          },
        ],
      };
      await persistenceService.saveAuditLog(log);

      if (resolution === 'confirmed' && action !== 'reject') {
        const { useSessionStore } = await import('@/stores/useSessionStore');
        const sessionStore = useSessionStore.getState();
        const remainingPending = get().suspendedTasks.filter(
          (t) => t.sessionId === task.sessionId && t.status === 'pending' && t.id !== taskId
        );
        if (remainingPending.length === 0) {
          await sessionStore.updateSessionStatus(task.sessionId, 'pending');
        }
      }

      set((state) => ({
        suspendedTasks: state.suspendedTasks.map((t, i) =>
          i === taskIndex ? resolvedTask : t
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  hasManualEdits: () => {
    return auditLogService.hasManualEdits(get().logs);
  },

  getManualEditCount: () => {
    return auditLogService.getManualEditCount(get().logs);
  },

  clearLogs: () => set({ logs: [], auditLogs: [] }),

  clearError: () => set({ error: null }),
}));
