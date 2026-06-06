import { create } from 'zustand';
import type { Equipment } from '@/types';
import { storage } from '@/utils/storage';
import { mockEquipment } from '@/utils/mockData';
import { generateId } from '@/utils/helpers';

interface EquipmentState {
  equipment: Equipment[];
  init: () => void;
  addEquipment: (eq: Omit<Equipment, 'id'>) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;
  getEquipmentById: (id: string) => Equipment | undefined;
  resetToMock: () => void;
}

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  equipment: [],

  init: () => {
    const saved = storage.get<Equipment[]>('equipment', []);
    if (saved.length === 0) {
      set({ equipment: mockEquipment });
      storage.set('equipment', mockEquipment);
    } else {
      set({ equipment: saved });
    }
  },

  addEquipment: (eq) => {
    const newEq: Equipment = {
      ...eq,
      id: generateId(),
    };
    const newList = [...get().equipment, newEq];
    set({ equipment: newList });
    storage.set('equipment', newList);
  },

  updateEquipment: (id, updates) => {
    const newList = get().equipment.map(e =>
      e.id === id ? { ...e, ...updates } : e
    );
    set({ equipment: newList });
    storage.set('equipment', newList);
  },

  deleteEquipment: (id) => {
    const newList = get().equipment.filter(e => e.id !== id);
    set({ equipment: newList });
    storage.set('equipment', newList);
  },

  getEquipmentById: (id) => {
    return get().equipment.find(e => e.id === id);
  },

  resetToMock: () => {
    set({ equipment: mockEquipment });
    storage.set('equipment', mockEquipment);
  },
}));
