import { getStore } from '../database/memoryStore';
import { EmergencyShelter } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const shelterDao = {
  create: (data: Omit<EmergencyShelter, 'id' | 'createdAt' | 'updatedAt'>): EmergencyShelter => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const shelter: EmergencyShelter = { ...data, id, createdAt: now, updatedAt: now };
    store.shelters.push(shelter);
    return shelter;
  },

  findById: (id: string): EmergencyShelter | null => {
    const store = getStore();
    return store.shelters.find(s => s.id === id) || null;
  },

  findAll: (): EmergencyShelter[] => {
    const store = getStore();
    return [...store.shelters].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  update: (id: string, data: Partial<EmergencyShelter>): void => {
    const store = getStore();
    const idx = store.shelters.findIndex(s => s.id === id);
    if (idx !== -1) {
      store.shelters[idx] = { ...store.shelters[idx], ...data, updatedAt: getCurrentTime() };
    }
  },

  updateStatus: (id: string, status: EmergencyShelter['status']): void => {
    shelterDao.update(id, { status });
  }
};
