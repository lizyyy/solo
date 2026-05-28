import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { DataModification } from '../types';

interface ModificationFilters {
  entityType?: DataModification['entityType'];
  entityId?: string;
  fieldName?: string;
  modifiedBy?: string;
  startTime?: number;
  endTime?: number;
}

interface ModificationState {
  modifications: DataModification[];
  isLoading: boolean;
  error: string | null;
  currentUser: string;
}

interface ModificationStore extends ModificationState {
  recordModification: (
    params: Omit<DataModification, 'id' | 'modifiedAt' | 'modifiedBy' | 'isRollback'> & {
      reason: string;
    }
  ) => DataModification | null;
  rollbackModification: (modificationId: string, reason: string) => boolean;
  getModificationById: (modificationId: string) => DataModification | undefined;
  getModifications: (filters?: ModificationFilters) => DataModification[];
  getModificationsByEntity: (
    entityType: DataModification['entityType'],
    entityId: string
  ) => DataModification[];
  getModificationsByUser: (modifiedBy: string) => DataModification[];
  getModificationsByTimeRange: (start: number, end: number) => DataModification[];
  getEntityHistory: (
    entityType: DataModification['entityType'],
    entityId: string
  ) => Array<{ fieldName: string; values: Array<{ value: string; timestamp: number }> }>;
  clearOldModifications: (beforeTimestamp: number) => number;
  setCurrentUser: (user: string) => void;
  validateModificationReason: (reason: string) => { valid: boolean; message?: string };
}

const STORAGE_KEY = 'robot-warehouse-modifications';

const getInitialState = (): ModificationState => ({
  modifications: [],
  isLoading: false,
  error: null,
  currentUser: 'admin',
});

export const useModificationStore = create<ModificationStore>()(
  persist(
    (set, get) => ({
      ...getInitialState(),

      validateModificationReason: (reason) => {
        if (!reason || reason.trim().length === 0) {
          return { valid: false, message: '修改理由不能为空' };
        }
        if (reason.trim().length < 10) {
          return { valid: false, message: '修改理由至少需要10个字符' };
        }
        return { valid: true };
      },

      recordModification: (params) => {
        const validation = get().validateModificationReason(params.reason);
        if (!validation.valid) {
          set({ error: validation.message });
          return null;
        }

        const newModification: DataModification = {
          id: uuidv4(),
          entityType: params.entityType,
          entityId: params.entityId,
          fieldName: params.fieldName,
          oldValue: params.oldValue,
          newValue: params.newValue,
          modifiedBy: get().currentUser,
          modifiedAt: Date.now(),
          reason: params.reason.trim(),
          isRollback: false,
        };

        set((state) => ({
          modifications: [newModification, ...state.modifications],
          error: null,
        }));

        return newModification;
      },

      rollbackModification: (modificationId, reason) => {
        const validation = get().validateModificationReason(reason);
        if (!validation.valid) {
          set({ error: validation.message });
          return false;
        }

        const modification = get().getModificationById(modificationId);
        if (!modification) {
          set({ error: '找不到要回滚的修改记录' });
          return false;
        }

        const rollbackModification: DataModification = {
          id: uuidv4(),
          entityType: modification.entityType,
          entityId: modification.entityId,
          fieldName: modification.fieldName,
          oldValue: modification.newValue,
          newValue: modification.oldValue,
          modifiedBy: get().currentUser,
          modifiedAt: Date.now(),
          reason: reason.trim(),
          isRollback: true,
          rollbackFrom: modificationId,
        };

        set((state) => ({
          modifications: [rollbackModification, ...state.modifications],
          error: null,
        }));

        return true;
      },

      getModificationById: (modificationId) => {
        return get().modifications.find((m) => m.id === modificationId);
      },

      getModifications: (filters) => {
        let result = [...get().modifications];

        if (filters?.entityType) {
          result = result.filter((m) => m.entityType === filters.entityType);
        }
        if (filters?.entityId) {
          result = result.filter((m) => m.entityId === filters.entityId);
        }
        if (filters?.fieldName) {
          result = result.filter((m) => m.fieldName === filters.fieldName);
        }
        if (filters?.modifiedBy) {
          result = result.filter((m) => m.modifiedBy === filters.modifiedBy);
        }
        if (filters?.startTime) {
          result = result.filter((m) => m.modifiedAt >= filters.startTime!);
        }
        if (filters?.endTime) {
          result = result.filter((m) => m.modifiedAt <= filters.endTime!);
        }

        return result.sort((a, b) => b.modifiedAt - a.modifiedAt);
      },

      getModificationsByEntity: (entityType, entityId) => {
        return get().getModifications({ entityType, entityId });
      },

      getModificationsByUser: (modifiedBy) => {
        return get().getModifications({ modifiedBy });
      },

      getModificationsByTimeRange: (start, end) => {
        return get().getModifications({ startTime: start, endTime: end });
      },

      getEntityHistory: (entityType, entityId) => {
        const modifications = get().getModificationsByEntity(entityType, entityId);
        const fieldHistory = new Map<
          string,
          Array<{ value: string; timestamp: number; isRollback: boolean }>
        >();

        modifications.forEach((mod) => {
          if (!fieldHistory.has(mod.fieldName)) {
            fieldHistory.set(mod.fieldName, []);
          }
          fieldHistory.get(mod.fieldName)!.push({
            value: mod.newValue,
            timestamp: mod.modifiedAt,
            isRollback: mod.isRollback,
          });
          if (!mod.isRollback) {
            fieldHistory.get(mod.fieldName)!.push({
              value: mod.oldValue,
              timestamp: mod.modifiedAt - 1,
              isRollback: false,
            });
          }
        });

        return Array.from(fieldHistory.entries()).map(([fieldName, values]) => ({
          fieldName,
          values: values
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((v) => ({ value: v.value, timestamp: v.timestamp })),
        }));
      },

      clearOldModifications: (beforeTimestamp) => {
        const count = get().modifications.filter((m) => m.modifiedAt < beforeTimestamp).length;
        set((state) => ({
          modifications: state.modifications.filter((m) => m.modifiedAt >= beforeTimestamp),
        }));
        return count;
      },

      setCurrentUser: (user) => {
        set({ currentUser: user });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        modifications: state.modifications,
        currentUser: state.currentUser,
      }),
    }
  )
);
