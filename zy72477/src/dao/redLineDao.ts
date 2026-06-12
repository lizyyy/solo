import { getStore } from '../database/memoryStore';
import { RedLineMap } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const redLineDao = {
  create: (data: Omit<RedLineMap, 'id' | 'importTime'> & Partial<Pick<RedLineMap, 'isReimport' | 'reimportNote' | 'reviewStatus' | 'reviewNote' | 'reviewedBy' | 'reviewedAt' | 'prevVersionId'>>): RedLineMap => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const redLine: RedLineMap = {
      ...data,
      id,
      importTime: now,
      isReimport: data.isReimport || false,
      reimportNote: data.reimportNote || null,
      reviewStatus: data.reviewStatus || 'pending',
      reviewNote: data.reviewNote || null,
      reviewedBy: data.reviewedBy || null,
      reviewedAt: data.reviewedAt || null,
      prevVersionId: data.prevVersionId || null
    };
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
  },

  getAllBatchNos: (): string[] => {
    const store = getStore();
    const batches = new Set(store.redLineMaps.map(r => r.importBatchNo));
    return Array.from(batches).sort((a, b) => b.localeCompare(a));
  },

  updateReview: (id: string, reviewStatus: RedLineMap['reviewStatus'], reviewNote: string, reviewedBy: string): void => {
    const store = getStore();
    const idx = store.redLineMaps.findIndex(r => r.id === id);
    if (idx !== -1) {
      store.redLineMaps[idx] = {
        ...store.redLineMaps[idx],
        reviewStatus,
        reviewNote,
        reviewedBy,
        reviewedAt: getCurrentTime()
      };
    }
  },

  updateRemarks: (id: string, remarks: string, operator: string): void => {
    const store = getStore();
    const idx = store.redLineMaps.findIndex(r => r.id === id);
    if (idx !== -1) {
      store.redLineMaps[idx] = {
        ...store.redLineMaps[idx],
        remarks,
        importTime: getCurrentTime(),
        importOperator: operator
      };
    }
  }
};
