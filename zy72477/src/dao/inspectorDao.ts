import { getStore } from '../database/memoryStore';
import { GridInspectorReport } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const inspectorDao = {
  create: (data: Omit<GridInspectorReport, 'id' | 'submittedAt'>): GridInspectorReport => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const report: GridInspectorReport = { ...data, id, submittedAt: now };
    store.inspectorReports.push(report);
    return report;
  },

  findById: (id: string): GridInspectorReport | null => {
    const store = getStore();
    return store.inspectorReports.find(r => r.id === id) || null;
  },

  findByShelterId: (shelterId: string): GridInspectorReport[] => {
    const store = getStore();
    return store.inspectorReports
      .filter(r => r.shelterId === shelterId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },

  findLatestByShelterId: (shelterId: string): GridInspectorReport | null => {
    const reports = inspectorDao.findByShelterId(shelterId);
    return reports[0] || null;
  },

  findAll: (): GridInspectorReport[] => {
    const store = getStore();
    return [...store.inspectorReports].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },

  findDetourNotSynced: (): GridInspectorReport[] => {
    const store = getStore();
    return store.inspectorReports.filter(r => {
      if (!r.isTemporaryDetour) return false;
      const hasSynced = store.capacityCheckResults.some(c =>
        c.shelterId === r.shelterId && c.isDetourAffected && new Date(c.checkTime) > new Date(r.submittedAt)
      );
      return !hasSynced;
    });
  }
};
