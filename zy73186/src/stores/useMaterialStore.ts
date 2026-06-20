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
    newContent: string
  ) => Promise<Material | null>;
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
      const materials = await persistenceService.getMaterialsBySession(sessionId);
      set({ materials, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadAllMaterials: async () => {
    set({ isLoading: true, error: null });
    try {
      const materials = await persistenceService.getAllMaterials();
      set({ materials, isLoading: false });
    } catch (error) {
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

  updateMaterialContent: async (materialId, newContent) => {
    const { materials } = get();
    const material = materials.find((m) => m.id === materialId);

    if (!material) {
      set({ error: '材料不存在' });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const updatedMaterial = await versionHashService.updateMaterialContent(material, newContent);
      await persistenceService.saveMaterial(updatedMaterial);

      set((state) => ({
        materials: state.materials.map((m) =>
          m.id === materialId ? updatedMaterial : m
        ),
        isLoading: false,
      }));

      return updatedMaterial;
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
