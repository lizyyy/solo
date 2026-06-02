import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditLogEntry } from '@/types';
import { seedAuditLogs } from '@/data/seedData';

interface AuditState {
  logs: AuditLogEntry[];
  addLog: (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => void;
  getLogsByScheduleId: (scheduleId: string) => AuditLogEntry[];
}

let auditCounter = 0;

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      logs: [],
      addLog: (entry) =>
        set((state) => {
          auditCounter = Math.max(
            auditCounter,
            ...state.logs.map((l) => {
              const num = parseInt(l.id.replace('audit-', ''), 10);
              return isNaN(num) ? 0 : num;
            })
          );
          auditCounter += 1;
          const newLog: AuditLogEntry = {
            ...entry,
            id: `audit-${String(auditCounter).padStart(3, '0')}`,
            createdAt: new Date().toISOString(),
          };
          return { logs: [...state.logs, newLog] };
        }),
      getLogsByScheduleId: (scheduleId) =>
        get().logs.filter((l) => l.scheduleId === scheduleId),
    }),
    {
      name: 'festival-audit-logs',
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<AuditState>) };
        if (!merged.logs || merged.logs.length === 0) {
          merged.logs = seedAuditLogs;
        }
        return merged;
      },
    }
  )
);
