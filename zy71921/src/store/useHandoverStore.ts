import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Handover,
  HandoverStatus,
  Material,
  Exception,
  StatusLog,
  Confirmation,
  MaterialType,
  ExceptionType,
  ExceptionSeverity,
} from '@/types';
import { generateId, parseFileName, checkDuplicate, checkMissingMaterials } from '@/utils/materialParser';

interface HandoverState {
  currentHandoverId: string | null;
  handovers: Handover[];
  materials: Material[];
  exceptions: Exception[];
  statusLogs: StatusLog[];
  confirmations: Confirmation[];
  operator: string;

  createHandover: (title: string, description?: string) => Handover;
  selectHandover: (id: string) => void;
  updateHandoverStatus: (id: string, status: HandoverStatus, remark?: string) => void;
  deleteHandover: (id: string) => void;

  addMaterial: (handoverId: string, file: File, isLate?: boolean) => Promise<{ material: Material; exceptions: Exception[] }>;
  addMaterialManual: (handoverId: string, type: MaterialType, name: string, metadata?: Record<string, any>) => Material;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  relateMaterials: (sourceId: string, targetIds: string[]) => void;
  markMaterialCorrected: (id: string) => void;

  addException: (
    handoverId: string,
    type: ExceptionType,
    severity: ExceptionSeverity,
    description: string,
    relatedMaterialId?: string
  ) => Exception;
  resolveException: (id: string, resolution: string, explanation?: string) => void;
  ignoreException: (id: string) => void;

  addConfirmation: (handoverId: string, relatedMaterialIds: string[], remark?: string) => Confirmation;

  getCurrentHandover: () => Handover | undefined;
  getMaterialsForHandover: (handoverId: string) => Material[];
  getExceptionsForHandover: (handoverId: string) => Exception[];
  getStatusLogsForHandover: (handoverId: string) => StatusLog[];
  getConfirmationsForHandover: (handoverId: string) => Confirmation[];

  reset: () => void;
}

const initialState = {
  currentHandoverId: null,
  handovers: [],
  materials: [],
  exceptions: [],
  statusLogs: [],
  confirmations: [],
  operator: '画廊助理',
};

export const useHandoverStore = create<HandoverState>()(
  persist(
    (set, get) => ({
      ...initialState,

      createHandover: (title: string, description?: string) => {
        const now = new Date().toISOString();
        const handover: Handover = {
          id: generateId(),
          title,
          description,
          status: 'draft',
          operator: get().operator,
          createdAt: now,
          updatedAt: now,
        };

        set(state => ({
          handovers: [...state.handovers, handover],
          currentHandoverId: handover.id,
        }));

        get().updateHandoverStatus(handover.id, 'draft', '创建交接单');
        return handover;
      },

      selectHandover: (id: string) => {
        set({ currentHandoverId: id });
      },

      updateHandoverStatus: (id: string, status: HandoverStatus, remark?: string) => {
        const handover = get().handovers.find(h => h.id === id);
        if (!handover) return;

        const now = new Date().toISOString();
        const log: StatusLog = {
          id: generateId(),
          handoverId: id,
          fromStatus: handover.status,
          toStatus: status,
          operator: get().operator,
          remark,
          createdAt: now,
        };

        set(state => ({
          handovers: state.handovers.map(h =>
            h.id === id ? { ...h, status, updatedAt: now } : h
          ),
          statusLogs: [...state.statusLogs, log],
        }));
      },

      deleteHandover: (id: string) => {
        set(state => ({
          handovers: state.handovers.filter(h => h.id !== id),
          materials: state.materials.filter(m => m.handoverId !== id),
          exceptions: state.exceptions.filter(e => e.handoverId !== id),
          statusLogs: state.statusLogs.filter(l => l.handoverId !== id),
          confirmations: state.confirmations.filter(c => c.handoverId !== id),
          currentHandoverId: state.currentHandoverId === id ? null : state.currentHandoverId,
        }));
      },

      addMaterial: async (handoverId: string, file: File, isLate?: boolean) => {
        const parsed = parseFileName(file.name);
        const existingMaterials = get().getMaterialsForHandover(handoverId);
        const duplicateCheck = checkDuplicate(file.name, file.size, existingMaterials);

        let fileData: string | undefined;
        if (file.type.startsWith('image/') || file.size < 1024 * 1024) {
          const reader = new FileReader();
          fileData = await new Promise(resolve => {
            reader.onload = e => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }

        const material: Material = {
          id: generateId(),
          handoverId,
          type: parsed.type,
          name: parsed.name,
          fileName: file.name,
          fileSize: file.size,
          fileData,
          status: isLate ? 'late' : duplicateCheck.isDuplicate ? 'duplicate' : parsed.status,
          isDuplicate: duplicateCheck.isDuplicate,
          duplicateOf: duplicateCheck.duplicateOf,
          isLate,
          relatedIds: [],
          metadata: {
            ...parsed.metadata,
            type: file.type,
          },
          createdAt: new Date().toISOString(),
        };

        const newExceptions: Exception[] = [];

        if (duplicateCheck.isDuplicate) {
          newExceptions.push({
            id: generateId(),
            handoverId,
            type: 'duplicate_record',
            severity: 'low',
            relatedMaterialId: material.id,
            description: `检测到重复文件: ${file.name}`,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
        }

        if (isLate) {
          newExceptions.push({
            id: generateId(),
            handoverId,
            type: 'late_attachment',
            severity: 'medium',
            relatedMaterialId: material.id,
            description: `晚到附件: ${file.name}`,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
        }

        set(state => ({
          materials: [...state.materials, material],
          exceptions: [...state.exceptions, ...newExceptions],
        }));

        const allMaterials = get().getMaterialsForHandover(handoverId);
        const missingExceptions = checkMissingMaterials(allMaterials);
        
        if (missingExceptions.length > 0) {
          missingExceptions.forEach(e => {
            const exists = get().exceptions.some(
              existing => existing.type === e.type && existing.handoverId === handoverId && existing.status === 'open'
            );
            if (!exists) {
              get().addException(handoverId, e.type, e.severity, e.description);
            }
          });
        }

        return { material, exceptions: newExceptions };
      },

      addMaterialManual: (handoverId: string, type: MaterialType, name: string, metadata: Record<string, any> = {}) => {
        const material: Material = {
          id: generateId(),
          handoverId,
          type,
          name,
          status: 'normal',
          relatedIds: [],
          metadata,
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          materials: [...state.materials, material],
        }));

        return material;
      },

      updateMaterial: (id: string, updates: Partial<Material>) => {
        set(state => ({
          materials: state.materials.map(m =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      deleteMaterial: (id: string) => {
        set(state => ({
          materials: state.materials.filter(m => m.id !== id),
          exceptions: state.exceptions.filter(e => e.relatedMaterialId !== id),
        }));
      },

      relateMaterials: (sourceId: string, targetIds: string[]) => {
        set(state => ({
          materials: state.materials.map(m => {
            if (m.id === sourceId) {
              return { ...m, relatedIds: [...new Set([...m.relatedIds, ...targetIds])] };
            }
            if (targetIds.includes(m.id)) {
              return { ...m, relatedIds: [...new Set([...m.relatedIds, sourceId])] };
            }
            return m;
          }),
        }));
      },

      markMaterialCorrected: (id: string) => {
        const material = get().materials.find(m => m.id === id);
        if (!material) return;

        set(state => ({
          materials: state.materials.map(m =>
            m.id === id ? { ...m, status: 'corrected', correctedFrom: m.status } : m
          ),
        }));

        const relatedExceptions = get().exceptions.filter(
          e => e.relatedMaterialId === id && e.status === 'open'
        );
        relatedExceptions.forEach(e => {
          get().resolveException(e.id, '材料已更正', '人工更正材料内容');
        });
      },

      addException: (
        handoverId: string,
        type: ExceptionType,
        severity: ExceptionSeverity,
        description: string,
        relatedMaterialId?: string
      ) => {
        const exception: Exception = {
          id: generateId(),
          handoverId,
          type,
          severity,
          relatedMaterialId,
          description,
          status: 'open',
          createdAt: new Date().toISOString(),
        };

        set(state => ({
          exceptions: [...state.exceptions, exception],
        }));

        return exception;
      },

      resolveException: (id: string, resolution: string, explanation?: string) => {
        const now = new Date().toISOString();
        set(state => ({
          exceptions: state.exceptions.map(e =>
            e.id === id
              ? {
                  ...e,
                  status: 'resolved',
                  resolution,
                  explanation,
                  resolvedAt: now,
                  resolvedBy: get().operator,
                }
              : e
          ),
        }));
      },

      ignoreException: (id: string) => {
        set(state => ({
          exceptions: state.exceptions.map(e =>
            e.id === id ? { ...e, status: 'ignored' } : e
          ),
        }));
      },

      addConfirmation: (handoverId: string, relatedMaterialIds: string[], remark?: string) => {
        const confirmation: Confirmation = {
          id: generateId(),
          handoverId,
          operator: get().operator,
          remark,
          relatedMaterialIds,
          confirmedAt: new Date().toISOString(),
        };

        set(state => ({
          confirmations: [...state.confirmations, confirmation],
        }));

        get().updateHandoverStatus(handoverId, 'pending_confirm', remark || '人工确认完成');

        return confirmation;
      },

      getCurrentHandover: () => {
        const { currentHandoverId, handovers } = get();
        return handovers.find(h => h.id === currentHandoverId);
      },

      getMaterialsForHandover: (handoverId: string) => {
        return get().materials.filter(m => m.handoverId === handoverId);
      },

      getExceptionsForHandover: (handoverId: string) => {
        return get().exceptions.filter(e => e.handoverId === handoverId);
      },

      getStatusLogsForHandover: (handoverId: string) => {
        return get().statusLogs.filter(l => l.handoverId === handoverId);
      },

      getConfirmationsForHandover: (handoverId: string) => {
        return get().confirmations.filter(c => c.handoverId === handoverId);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'gallery-handover-storage',
    }
  )
);
