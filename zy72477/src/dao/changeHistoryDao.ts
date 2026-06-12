import { getStore } from '../database/memoryStore';
import { ChangeHistory } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const changeHistoryDao = {
  create: (data: Omit<ChangeHistory, 'id' | 'changeTime'>): ChangeHistory => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const record: ChangeHistory = { ...data, id, changeTime: now };
    store.changeHistories.push(record);
    return record;
  },

  findById: (id: string): ChangeHistory | null => {
    const store = getStore();
    return store.changeHistories.find(h => h.id === id) || null;
  },

  findByShelterId: (shelterId: string): ChangeHistory[] => {
    const store = getStore();
    return store.changeHistories
      .filter(h => h.shelterId === shelterId)
      .sort((a, b) => b.changeTime.localeCompare(a.changeTime));
  },

  findByEntity: (entityType: ChangeHistory['entityType'], entityId: string): ChangeHistory[] => {
    const store = getStore();
    return store.changeHistories
      .filter(h => h.entityType === entityType && h.entityId === entityId)
      .sort((a, b) => b.changeTime.localeCompare(a.changeTime));
  },

  findByChangeType: (changeType: ChangeHistory['changeType']): ChangeHistory[] => {
    const store = getStore();
    return store.changeHistories
      .filter(h => h.changeType === changeType)
      .sort((a, b) => b.changeTime.localeCompare(a.changeTime));
  },

  findAll: (): ChangeHistory[] => {
    const store = getStore();
    return [...store.changeHistories].sort((a, b) => b.changeTime.localeCompare(a.changeTime));
  }
};
