import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Point, MergeGroup, PointStatus, HistoryRecord } from '../types';
import { findMergeGroups, mergePoints } from '../utils/matching';
import { generateSampleData, generateSmoothCaseData, generateReworkCaseData } from '../data/sampleData';

interface AppState {
  points: Point[];
  mergeGroups: MergeGroup[];
  selectedPointId: string | null;
  currentStep: 'import' | 'merge' | 'review' | 'export';
  isLoading: boolean;
  importStats: {
    total: number;
    gis: number;
    resident: number;
    inspection: number;
    street: number;
  };
}

interface AppActions {
  addPoints: (newPoints: Point[]) => void;
  removePoint: (id: string) => void;
  updatePoint: (id: string, updates: Partial<Point>) => void;
  updatePointStatus: (id: string, status: PointStatus, remark?: string) => void;
  addRemark: (id: string, remark: string) => void;
  generateMergeGroups: (threshold?: number) => void;
  confirmMerge: (groupId: string) => void;
  rejectMerge: (groupId: string) => void;
  updateMergeName: (groupId: string, name: string) => void;
  updateMergeAddress: (groupId: string, address: string) => void;
  setSelectedPointId: (id: string | null) => void;
  setCurrentStep: (step: 'import' | 'merge' | 'review' | 'export') => void;
  loadSampleData: () => void;
  loadSmoothCase: () => void;
  loadReworkCase: () => void;
  clearAllData: () => void;
  resolveConflict: (pointId: string, conflictIndex: number, resolution: 'use_gis' | 'use_import' | 'custom', customValue?: string) => void;
  addHistoryRecord: (pointId: string, record: Omit<HistoryRecord, 'id' | 'pointId' | 'timestamp'>) => void;
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      points: [],
      mergeGroups: [],
      selectedPointId: null,
      currentStep: 'import',
      isLoading: false,
      importStats: {
        total: 0,
        gis: 0,
        resident: 0,
        inspection: 0,
        street: 0,
      },

      addPoints: (newPoints) => {
        set((state) => ({
          points: [...state.points, ...newPoints],
          importStats: {
            total: state.importStats.total + newPoints.length,
            gis: state.importStats.gis + newPoints.filter((p) => p.source === 'gis').length,
            resident: state.importStats.resident + newPoints.filter((p) => p.source === 'resident').length,
            inspection: state.importStats.inspection + newPoints.filter((p) => p.source === 'inspection').length,
            street: state.importStats.street + newPoints.filter((p) => p.source === 'street').length,
          },
        }));
      },

      removePoint: (id) => {
        set((state) => ({
          points: state.points.filter((p) => p.id !== id),
        }));
      },

      updatePoint: (id, updates) => {
        set((state) => ({
          points: state.points.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      updatePointStatus: (id, status, remark) => {
        set((state) => {
          const point = state.points.find((p) => p.id === id);
          if (!point) return state;

          const newHistory: HistoryRecord = {
            id: `hist-${Date.now()}`,
            pointId: id,
            action: 'status_change',
            oldValue: point.status,
            newValue: status,
            operator: '周姐',
            timestamp: new Date().toISOString(),
            remark,
          };

          return {
            points: state.points.map((p) =>
              p.id === id
                ? {
                    ...p,
                    status,
                    updatedAt: new Date().toISOString(),
                    history: [...p.history, newHistory],
                  }
                : p
            ),
          };
        });
      },

      addRemark: (id, remark) => {
        set((state) => {
          const newHistory: HistoryRecord = {
            id: `hist-${Date.now()}`,
            pointId: id,
            action: 'remark',
            operator: '周姐',
            timestamp: new Date().toISOString(),
            remark,
          };

          return {
            points: state.points.map((p) =>
              p.id === id
                ? {
                    ...p,
                    description: p.description ? `${p.description}\n\n补充备注：${remark}` : remark,
                    updatedAt: new Date().toISOString(),
                    history: [...p.history, newHistory],
                  }
                : p
            ),
          };
        });
      },

      generateMergeGroups: (threshold = 0.6) => {
        const { points } = get();
        const groups = findMergeGroups(points, threshold);
        set({ mergeGroups: groups });
      },

      confirmMerge: (groupId) => {
        set((state) => {
          const group = state.mergeGroups.find((g) => g.id === groupId);
          if (!group) return state;

          const mergedPoint = mergePoints(group, group.mergedName, group.mergedAddress);
          const mergedIds = group.points.map((p) => p.id);

          return {
            points: [...state.points.filter((p) => !mergedIds.includes(p.id)), mergedPoint],
            mergeGroups: state.mergeGroups.map((g) =>
              g.id === groupId ? { ...g, confirmed: true } : g
            ),
          };
        });
      },

      rejectMerge: (groupId) => {
        set((state) => ({
          mergeGroups: state.mergeGroups.map((g) =>
            g.id === groupId ? { ...g, rejected: true } : g
          ),
        }));
      },

      updateMergeName: (groupId, name) => {
        set((state) => ({
          mergeGroups: state.mergeGroups.map((g) =>
            g.id === groupId ? { ...g, mergedName: name } : g
          ),
        }));
      },

      updateMergeAddress: (groupId, address) => {
        set((state) => ({
          mergeGroups: state.mergeGroups.map((g) =>
            g.id === groupId ? { ...g, mergedAddress: address } : g
          ),
        }));
      },

      setSelectedPointId: (id) => {
        set({ selectedPointId: id });
      },

      setCurrentStep: (step) => {
        set({ currentStep: step });
      },

      loadSampleData: () => {
        const sampleData = generateSampleData();
        set({
          points: sampleData,
          importStats: {
            total: sampleData.length,
            gis: sampleData.filter((p) => p.source === 'gis').length,
            resident: sampleData.filter((p) => p.source === 'resident').length,
            inspection: sampleData.filter((p) => p.source === 'inspection').length,
            street: sampleData.filter((p) => p.source === 'street').length,
          },
        });
      },

      loadSmoothCase: () => {
        const data = generateSmoothCaseData();
        set({
          points: data,
          importStats: {
            total: data.length,
            gis: data.filter((p) => p.source === 'gis').length,
            resident: data.filter((p) => p.source === 'resident').length,
            inspection: data.filter((p) => p.source === 'inspection').length,
            street: data.filter((p) => p.source === 'street').length,
          },
        });
      },

      loadReworkCase: () => {
        const data = generateReworkCaseData();
        set({
          points: data,
          importStats: {
            total: data.length,
            gis: data.filter((p) => p.source === 'gis').length,
            resident: data.filter((p) => p.source === 'resident').length,
            inspection: data.filter((p) => p.source === 'inspection').length,
            street: data.filter((p) => p.source === 'street').length,
          },
        });
      },

      clearAllData: () => {
        set({
          points: [],
          mergeGroups: [],
          selectedPointId: null,
          currentStep: 'import',
          importStats: {
            total: 0,
            gis: 0,
            resident: 0,
            inspection: 0,
            street: 0,
          },
        });
      },

      resolveConflict: (pointId, conflictIndex, resolution, customValue) => {
        set((state) => ({
          points: state.points.map((p) => {
            if (p.id !== pointId) return p;

            const newConflicts = [...p.conflicts];
            const conflict = newConflicts[conflictIndex];

            if (conflict) {
              newConflicts[conflictIndex] = {
                ...conflict,
                resolved: true,
                resolution,
                customValue,
              };
            }

            return {
              ...p,
              conflicts: newConflicts,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      addHistoryRecord: (pointId, record) => {
        set((state) => ({
          points: state.points.map((p) =>
            p.id === pointId
              ? {
                  ...p,
                  history: [
                    ...p.history,
                    {
                      ...record,
                      id: `hist-${Date.now()}`,
                      pointId,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : p
          ),
        }));
      },
    }),
    {
      name: 'life-circle-gap-store',
    }
  )
);
