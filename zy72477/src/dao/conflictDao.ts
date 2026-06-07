import { getStore } from '../database/memoryStore';
import { ConflictRecord } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const conflictDao = {
  create: (data: Omit<ConflictRecord, 'id' | 'createdAt' | 'status' | 'resolvedBy' | 'resolvedAt' | 'resolutionNote'>): ConflictRecord => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const conflict: ConflictRecord = {
      ...data, id, status: 'pending',
      resolvedBy: null, resolvedAt: null, resolutionNote: null,
      createdAt: now
    };
    store.conflictRecords.push(conflict);
    return conflict;
  },

  findById: (id: string): ConflictRecord | null => {
    const store = getStore();
    return store.conflictRecords.find(c => c.id === id) || null;
  },

  findByShelterId: (shelterId: string): ConflictRecord[] => {
    const store = getStore();
    return store.conflictRecords
      .filter(c => c.shelterId === shelterId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  findByStatus: (status: ConflictRecord['status']): ConflictRecord[] => {
    const store = getStore();
    return store.conflictRecords
      .filter(c => c.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  findAll: (): ConflictRecord[] => {
    const store = getStore();
    return [...store.conflictRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  resolve: (id: string, status: 'confirmed' | 'rejected', resolvedBy: string, resolutionNote: string): void => {
    const store = getStore();
    const idx = store.conflictRecords.findIndex(c => c.id === id);
    if (idx !== -1) {
      store.conflictRecords[idx] = {
        ...store.conflictRecords[idx],
        status,
        resolvedBy,
        resolvedAt: getCurrentTime(),
        resolutionNote
      };
    }
  }
};
