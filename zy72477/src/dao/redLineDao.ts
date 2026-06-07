import { getStore } from '../database/memoryStore';
import { RedLineMap } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const redLineDao = {
  create: (data: Omit<RedLineMap, 'id' | 'importTime'>): RedLineMap => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const redLine: RedLineMap = { ...data, id, importTime: now };
    store.redLineMaps.push(redLine);
    return redLine;
  },

  setOldToNotLatest: (shelterId: string): void => {
    const store = getStore();
    store.redLineMaps.forEach(r => {
      if (r.shelterId === shelterId && r.isLatest) {
        r.isLatest = false;
      }
    });
  },

  findById: (id: string): RedLineMap | null => {
    const store = getStore();
    return store.redLineMaps.find(r => r.id === id) || null;
  },

  findLatestByShelterId: (shelterId: string): RedLineMap | null => {
    const store = getStore();
    return store.redLineMaps.find(r => r.shelterId === shelterId && r.isLatest) || null;
  },

  findByShelterId: (shelterId: string): RedLineMap[] => {
    const store = getStore();
    return store.redLineMaps
      .filter(r => r.shelterId === shelterId)
      .sort((a, b) => b.importTime.localeCompare(a.importTime));
  },

  findByBatchNo: (batchNo: string): RedLineMap[] => {
    const store = getStore();
    return store.redLineMaps.filter(r => r.importBatchNo === batchNo);
  },

  findAll: (): RedLineMap[] => {
    const store = getStore();
    return [...store.redLineMaps].sort((a, b) => b.importTime.localeCompare(a.importTime));
  },

  countByShelterId: (shelterId: string): number => {
    const store = getStore();
    return store.redLineMaps.filter(r => r.shelterId === shelterId).length;
  }
};
