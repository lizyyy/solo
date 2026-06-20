import { create } from 'zustand';
import type { AuditLog, SuspendedTask } from '../types';
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
    resolutionNote?: string
  ) => Promise<void>;
  hasManualEdits: () => boolean;
  getManualEditCount: () => number;
  clearLogs: () => void;
  clearError: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  logs: [],
  get auditLogs() {
    return get().logs;
  },
  suspendedTasks: [],
  isLoading: false,
  error: null,

  loadLogs: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const logs = await persistenceService.getAuditLogsBySession(sessionId);
      set({ logs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllAuditLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const allLogs: AuditLog[] = [];
      const sessions = await persistenceService.getAllSessions();
      for (const session of sessions) {
        const sessionLogs = await persistenceService.getAuditLogsBySession(session.id);
        allLogs.push(...sessionLogs);
      }
      set({ logs: allLogs, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadSuspendedTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await persistenceService.getSuspendedTasks();
      set({ suspendedTasks: tasks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllSuspendedTasks: async () => {
    await get().loadSuspendedTasks();
  },

  loadPendingSuspendedTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await persistenceService.getPendingSuspendedTasks();
      set({ suspendedTasks: tasks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addLog: async (log: AuditLog) => {
    try {
      await persistenceService.saveAuditLog(log);
      set((state) => ({
        logs: [...state.logs, log],
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

  resolveSuspendedTask: async (taskId, resolution, resolvedBy, resolutionNote) => {
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

    set({ isLoading: true, error: null });
    try {
      await persistenceService.saveSuspendedTask(resolvedTask);

      const log =
        resolution === 'confirmed'
          ? auditLogService.logConfirm(task.sessionId, taskId, resolutionNote, resolvedBy)
          : auditLogService.logReject(task.sessionId, taskId, resolutionNote || '', resolvedBy);
      await persistenceService.saveAuditLog(log);

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

  clearLogs: () => set({ logs: [] }),

  clearError: () => set({ error: null }),
}));
