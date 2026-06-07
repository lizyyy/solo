import { getStore } from '../database/memoryStore';
import { SelfCheckResult, SelfCheckItemType } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const selfCheckDao = {
  create: (data: Omit<SelfCheckResult, 'id' | 'checkedAt'>): SelfCheckResult => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const result: SelfCheckResult = { ...data, id, checkedAt: now };
    store.selfCheckResults.push(result);
    return result;
  },

  findById: (id: string): SelfCheckResult | null => {
    const store = getStore();
    return store.selfCheckResults.find(r => r.id === id) || null;
  },

  findByType: (checkType: SelfCheckItemType): SelfCheckResult[] => {
    const store = getStore();
    return store.selfCheckResults
      .filter(r => r.checkType === checkType)
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  },

  findLatestBatch: (): SelfCheckResult[] => {
    const store = getStore();
    if (store.selfCheckResults.length === 0) return [];
    const latestTime = Math.max(...store.selfCheckResults.map(r => new Date(r.checkedAt).getTime()));
    const latestTimeStr = new Date(latestTime).toISOString();
    return store.selfCheckResults
      .filter(r => r.checkedAt === latestTimeStr)
      .sort((a, b) => a.checkType.localeCompare(b.checkType));
  },

  findAll: (): SelfCheckResult[] => {
    const store = getStore();
    return [...store.selfCheckResults].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  }
};
