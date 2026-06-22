import { create } from 'zustand';
import type { Material, MaterialType } from '../types';
import { persistenceService } from '../services/persistence';
import { versionHashService } from '../services/versionHash';
import { duplicateDetectionService } from '../services/duplicateDetection';
import { auditLogger } from '../services/auditLogger';

interface MaterialState {
  materials: Material[];
  isLoading: boolean;
  error: string | null;

  loadMaterials: (sessionId: string) => Promise<void>;
  loadAllMaterials: () => Promise<void>;
  addMaterial: (
    sessionId: string,
    type: MaterialType,
    content: string,
    name: string,
    operator?: string
  ) => Promise<{ material: Material; duplicateCheck: { isDuplicate: boolean; similarity: number; existingSessionId?: string } }>;
  updateMaterialContent: (
    materialId: string,
    newContent: string,
    operator?: string
  ) => Promise<{ material: Material; hasCaliberChanged: boolean } | null>;
  deleteMaterial: (materialId: string) => Promise<void>;
  getMaterialById: (materialId: string) => Material | undefined;
  getMaterialsByType: (type: MaterialType) => Material[];
  clearMaterials: () => void;
  clearError: () => void;
}

export const useMaterialStore = create<MaterialState>((set, get) => ({
  materials: [],
  isLoading: false,
  error: null,

  loadMaterials: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('getMaterialsBySession timeout')), 5000);
      });
      const materials = await Promise.race([
        persistenceService.getMaterialsBySession(sessionId),
        timeoutPromise,
      ]);
      if (materials && materials.length > 0) {
        set({ materials, isLoading: false });
        return;
      }
      const { materials: existingMaterials } = get();
      const sessionMaterials = existingMaterials.filter((m) => m.sessionId === sessionId);
      if (sessionMaterials.length > 0) {
        console.log('[MaterialStore] Store already has session materials, keeping:', sessionMaterials.length);
        set({ isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.materials && backup.materials.length > 0) {
            const filtered = backup.materials.filter((m: Material) => m.sessionId === sessionId);
            if (filtered.length > 0) {
              console.log('[MaterialStore] Falling back to localStorage session materials:', filtered.length);
              set({ materials: filtered, isLoading: false });
              return;
            }
          }
        }
      } catch (e) {
        console.warn('[MaterialStore] Failed to load from localStorage backup:', e);
      }
      set({ isLoading: false });
    } catch (error) {
      console.warn('[MaterialStore] loadMaterials failed:', error);
      const { materials: existingMaterials } = get();
      const sessionMaterials = existingMaterials.filter((m) => m.sessionId === sessionId);
      if (sessionMaterials.length > 0) {
        console.log('[MaterialStore] Store already has hydrated session materials, keeping:', sessionMaterials.length);
        set({ error: (error as Error).message, isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.materials && backup.materials.length > 0) {
            const filtered = backup.materials.filter((m: Material) => m.sessionId === sessionId);
            if (filtered.length > 0) {
              console.log('[MaterialStore] Falling back to localStorage session materials:', filtered.length);
              set({ materials: filtered, error: (error as Error).message, isLoading: false });
              return;
            }
          }
        }
      } catch (e) {
        console.warn('[MaterialStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllMaterials: async () => {
    set({ isLoading: true, error: null });
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('getAllMaterials timeout')), 5000);
      });
      const materials = await Promise.race([
        persistenceService.getAllMaterials(),
        timeoutPromise,
      ]);
      if (materials && materials.length > 0) {
        set({ materials, isLoading: false });
        return;
      }
      const { materials: existingMaterials } = get();
      if (existingMaterials.length > 0) {
        console.log('[MaterialStore] Store already has hydrated materials, keeping:', existingMaterials.length);
        set({ isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.materials && backup.materials.length > 0) {
            console.log('[MaterialStore] Falling back to localStorage materials:', backup.materials.length);
            set({ materials: backup.materials, isLoading: false });
            return;
          }
        }
      } catch (e) {
        console.warn('[MaterialStore] Failed to load from localStorage backup:', e);
      }
      set({ isLoading: false });
    } catch (error) {
      console.warn('[MaterialStore] loadAllMaterials failed:', error);
      const { materials: existingMaterials } = get();
      if (existingMaterials.length > 0) {
        console.log('[MaterialStore] Store already has hydrated materials, keeping:', existingMaterials.length);
        set({ error: (error as Error).message, isLoading: false });
        return;
      }
      try {
        const lsBackup = localStorage.getItem('ep_boundary_backup_v1');
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.materials && backup.materials.length > 0) {
            console.log('[MaterialStore] Falling back to localStorage materials:', backup.materials.length);
            set({ materials: backup.materials, error: (error as Error).message, isLoading: false });
            return;
          }
        }
      } catch (e) {
        console.warn('[MaterialStore] Failed to load from localStorage backup:', e);
      }
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addMaterial: async (sessionId, type, content, name, operator) => {
    set({ isLoading: true, error: null });
    try {
      const material = await versionHashService.createNewMaterial(sessionId, type, content, name);

      await persistenceService.saveMaterial(material);

      const allMaterials = await persistenceService.getAllMaterials();
      const duplicateCheck = await duplicateDetectionService.findDuplicate(
        content,
        allMaterials.filter((m) => m.id !== material.id)
      );

      const log = auditLogger.logUploadMaterial(sessionId, type, name, operator);
      await persistenceService.saveAuditLog(log);

      set((state) => ({
        materials: [...state.materials, material],
        isLoading: false,
      }));

      return { material, duplicateCheck };
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateMaterialContent: async (materialId, newContent, operator) => {
    const { materials } = get();
    const material = materials.find((m) => m.id === materialId);

    if (!material) {
      set({ error: '材料不存在' });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const oldContent = material.content;
      const updatedMaterial = await versionHashService.updateMaterialContent(material, newContent);
      await persistenceService.saveMaterial(updatedMaterial);

      const hasCaliberChanged = versionHashService.detectCaliberChange(oldContent, newContent);
      
      const log = auditLogger.logUpdateMaterial(
        material.sessionId,
        materialId,
        material.type,
        material.name,
        operator
      );
      if (hasCaliberChanged) {
        log.diff = {
          before: oldContent,
          after: newContent,
          changeSummary: [{
            field: 'content',
            oldValue: oldContent.substring(0, 100) + '...',
            newValue: newContent.substring(0, 100) + '...',
          }],
        };
        log.description += '（检测到口径变更）';
      }
      await persistenceService.saveAuditLog(log);

      set((state) => ({
        materials: state.materials.map((m) =>
          m.id === materialId ? updatedMaterial : m
        ),
        isLoading: false,
      }));

      return {
        material: updatedMaterial,
        hasCaliberChanged,
      };
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      return null;
    }
  },

  deleteMaterial: async (materialId) => {
    set({ isLoading: true, error: null });
    try {
      set((state) => ({
        materials: state.materials.filter((m) => m.id !== materialId),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  getMaterialById: (materialId) => {
    return get().materials.find((m) => m.id === materialId);
  },

  getMaterialsByType: (type) => {
    return get().materials.filter((m) => m.type === type);
  },

  clearMaterials: () => set({ materials: [] }),

  clearError: () => set({ error: null }),
}));
