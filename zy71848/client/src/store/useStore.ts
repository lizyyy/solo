import { create } from 'zustand';
import type {
  InspectionRecord,
  BatchTask,
  ExportRecord,
  AppSettings,
  ConsistencyCheckResult,
} from '../../../shared/types';
import { api } from '../services/api';
import { mockInspections, mockBatchTasks, mockExportRecords, defaultSettings } from '../../../shared/mockData';
import { calculateContentHash } from '../utils/format';
import { generateMockExportContent } from '../utils/exportMock';

interface StoreState {
  inspections: InspectionRecord[];
  batchTasks: BatchTask[];
  exportRecords: ExportRecord[];
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  selectedStatusFilter: string | null;
  selectedInspectionIds: string[];
  consistencyCheckResult: ConsistencyCheckResult | null;

  fetchInspections: () => Promise<void>;
  fetchBatchTasks: () => Promise<void>;
  fetchExportRecords: () => Promise<void>;
  fetchSettings: () => Promise<void>;

  updateInspectionStatus: (id: string, status: InspectionRecord['status']) => Promise<void>;
  performFlip: (id: string, flipType: 'x' | 'y' | 'origin') => Promise<void>;
  addChangeRecord: (id: string, change: any) => Promise<void>;

  createBatchTask: (inspectionIds: string[], taskName: string) => Promise<void>;
  runBatchTask: (id: string) => Promise<void>;

  performConsistencyCheck: (inspectionIds: string[]) => Promise<void>;
  createExport: (inspectionIds: string[], template: 'standard' | 'detailed', performCheck: boolean) => Promise<void>;
  downloadExport: (id: string) => void;

  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;

  setStatusFilter: (status: string | null) => void;
  toggleInspectionSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
}

const useMock = true;

export const useStore = create<StoreState>((set, get) => ({
  inspections: [],
  batchTasks: [],
  exportRecords: [],
  settings: defaultSettings,
  loading: false,
  error: null,
  selectedStatusFilter: null,
  selectedInspectionIds: [],
  consistencyCheckResult: null,

  fetchInspections: async () => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        set({ inspections: [...mockInspections], loading: false });
      } else {
        const data = await api.inspections.getAll();
        set({ inspections: data, loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchBatchTasks: async () => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        set({ batchTasks: [...mockBatchTasks], loading: false });
      } else {
        const data = await api.batch.getAll();
        set({ batchTasks: data, loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchExportRecords: async () => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        set({ exportRecords: [...mockExportRecords], loading: false });
      } else {
        const data = await api.export.getAll();
        set({ exportRecords: data, loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        set({ settings: { ...defaultSettings }, loading: false });
      } else {
        const data = await api.settings.get();
        set({ settings: data, loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateInspectionStatus: async (id: string, status: InspectionRecord['status']) => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        set((state) => ({
          inspections: state.inspections.map((i) =>
            i.id === id ? { ...i, status, updatedAt: new Date().toISOString() } : i
          ),
          loading: false,
        }));
      } else {
        const updated = await api.inspections.updateStatus(id, status);
        set((state) => ({
          inspections: state.inspections.map((i) => (i.id === id ? updated : i)),
          loading: false,
        }));
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  performFlip: async (id: string, flipType: 'x' | 'y' | 'origin') => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        const { flipCoordinates } = await import('../utils/format');
        set((state) => {
          const inspection = state.inspections.find((i) => i.id === id);
          if (!inspection) return { loading: false };
          const { flipped, deviation } = flipCoordinates(inspection.coordinates, flipType);
          const threshold = state.settings.flipRules.deviationThreshold;
          const newStatus = deviation > threshold ? 'exception' : inspection.status;
          return {
            inspections: state.inspections.map((i) =>
              i.id === id
                ? {
                    ...i,
                    flippedCoordinates: flipped,
                    flipDeviation: deviation,
                    status: newStatus,
                    updatedAt: new Date().toISOString(),
                    changeHistory: [
                      ...i.changeHistory,
                      {
                        id: Math.random().toString(36).slice(2, 10),
                        inspectionId: id,
                        type: 'flip',
                        affectsConclusion: deviation > threshold,
                        description: `坐标轴${flipType === 'x' ? 'X轴' : flipType === 'y' ? 'Y轴' : '原点'}翻转，偏差${(deviation * 100).toFixed(1)}%${deviation > threshold ? '，需确认' : ''}`,
                        operator: '系统',
                        timestamp: new Date().toISOString(),
                      },
                    ],
                  }
                : i
            ),
            loading: false,
          };
        });
      } else {
        const result = await api.inspections.flip(id, flipType);
        set((state) => ({
          inspections: state.inspections.map((i) => (i.id === id ? result.flipped : i)),
          loading: false,
        }));
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addChangeRecord: async (id: string, change: any) => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        set((state) => ({
          inspections: state.inspections.map((i) =>
            i.id === id
              ? {
                  ...i,
                  updatedAt: new Date().toISOString(),
                  changeHistory: [
                    ...i.changeHistory,
                    {
                      ...change,
                      id: Math.random().toString(36).slice(2, 10),
                      inspectionId: id,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : i
          ),
          loading: false,
        }));
      } else {
        await api.inspections.addChange(id, change);
        await get().fetchInspections();
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createBatchTask: async (inspectionIds: string[], taskName: string) => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        const newTask: BatchTask = {
          id: Math.random().toString(36).slice(2, 10),
          name: taskName,
          inspectionIds,
          status: 'pending',
          runCount: 0,
          totalChanges: 0,
          conclusionChanges: 0,
          materialOnlyChanges: 0,
          createdAt: new Date().toISOString(),
          runs: [],
          lastRunHashes: {},
        };
        set((state) => ({
          batchTasks: [newTask, ...state.batchTasks],
          loading: false,
        }));
      } else {
        const task = await api.batch.create({ inspectionIds, taskName });
        set((state) => ({
          batchTasks: [task, ...state.batchTasks],
          loading: false,
        }));
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  runBatchTask: async (id: string) => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        const { calculateContentHash } = await import('../utils/format');
        set((state) => {
          const task = state.batchTasks.find((t) => t.id === id);
          if (!task) return { loading: false };

          const runNumber = task.runCount + 1;
          const startTime = new Date();
          let processedCount = 0;
          let skippedCount = 0;
          let changedCount = 0;
          const changes: any[] = [];
          const newHashes: Record<string, string> = {};
          let conclusionChanges = task.conclusionChanges;
          let materialOnlyChanges = task.materialOnlyChanges;

          task.inspectionIds.forEach((inspectionId) => {
            const inspection = state.inspections.find((i) => i.id === inspectionId);
            if (!inspection) return;

            processedCount++;
            const lastHash = task.lastRunHashes?.[inspectionId];
            const currentHash = calculateContentHash({
              coordinates: inspection.coordinates,
              name: inspection.name,
              status: inspection.status,
            });
            newHashes[inspectionId] = currentHash;

            if (lastHash === currentHash) {
              skippedCount++;
              return;
            }

            if (inspection.changeHistory.length > 0) {
              const lastChange = inspection.changeHistory[inspection.changeHistory.length - 1];
              if (!lastChange.batchRunId) {
                changedCount++;
                changes.push({
                  inspectionId,
                  changeType: lastChange.type,
                  affectsConclusion: lastChange.affectsConclusion,
                  description: lastChange.description,
                });

                if (lastChange.affectsConclusion) {
                  conclusionChanges++;
                } else {
                  materialOnlyChanges++;
                }
              }
            }
          });

          const run = {
            id: Math.random().toString(36).slice(2, 10),
            taskId: id,
            runNumber,
            startTime: startTime.toISOString(),
            endTime: new Date().toISOString(),
            processedCount,
            skippedCount,
            changedCount,
            idempotentCheckPassed: true,
            changes,
          };

          return {
            batchTasks: state.batchTasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    runs: [...t.runs, run],
                    runCount: runNumber,
                    totalChanges: t.totalChanges + changedCount,
                    conclusionChanges,
                    materialOnlyChanges,
                    lastRunHashes: newHashes,
                    status: 'completed',
                  }
                : t
            ),
            loading: false,
          };
        });
      } else {
        const task = await api.batch.run(id);
        set((state) => ({
          batchTasks: state.batchTasks.map((t) => (t.id === id ? task : t)),
          loading: false,
        }));
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  performConsistencyCheck: async (inspectionIds: string[]) => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        const issues: any[] = [];
        const { inspections } = get();

        inspectionIds.forEach((id) => {
          const inspection = inspections.find((i) => i.id === id);
          if (!inspection) {
            issues.push({ inspectionId: id, field: 'existence', message: '检查记录不存在', severity: 'error' });
            return;
          }
          if (inspection.coordinates.points.length === 0) {
            issues.push({ inspectionId: id, field: 'coordinates', message: '坐标数据为空', severity: 'error' });
          }
          if (inspection.changeHistory.length === 0) {
            issues.push({ inspectionId: id, field: 'changeHistory', message: '无变更历史记录', severity: 'warning' });
          }
        });

        const result: ConsistencyCheckResult = {
          passed: issues.filter((i) => i.severity === 'error').length === 0,
          totalItems: inspectionIds.length,
          issues,
        };
        set({ consistencyCheckResult: result, loading: false });
      } else {
        const result = await api.export.check(inspectionIds);
        set({ consistencyCheckResult: result, loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createExport: async (inspectionIds: string[], template: 'standard' | 'detailed', performCheck: boolean) => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        let checkResult: ConsistencyCheckResult = {
          passed: true,
          totalItems: inspectionIds.length,
          issues: [],
        };

        if (performCheck) {
          await get().performConsistencyCheck(inspectionIds);
          checkResult = get().consistencyCheckResult || checkResult;
        }

        const newRecord: ExportRecord = {
          id: Math.random().toString(36).slice(2, 10),
          inspectionIds,
          template,
          consistencyCheck: checkResult,
          exportedAt: new Date().toISOString(),
          exportedBy: '当前用户',
          fileHash: calculateContentHash({ inspectionIds, template, timestamp: Date.now() }),
        };
        set((state) => ({
          exportRecords: [newRecord, ...state.exportRecords],
          loading: false,
        }));
      } else {
        const record = await api.export.create({ inspectionIds, template, performConsistencyCheck: performCheck });
        set((state) => ({
          exportRecords: [record, ...state.exportRecords],
          loading: false,
        }));
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  downloadExport: (id: string) => {
    if (useMock) {
      const content = generateMockExportContent(id, get());
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection-report-${id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      api.export.download(id);
    }
  },

  updateSettings: async (settings: Partial<AppSettings>) => {
    set({ loading: true, error: null });
    try {
      if (useMock) {
        set((state) => ({
          settings: { ...state.settings, ...settings },
          loading: false,
        }));
      } else {
        const updated = await api.settings.update(settings);
        set({ settings: updated, loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  setStatusFilter: (status: string | null) => set({ selectedStatusFilter: status }),

  toggleInspectionSelection: (id: string) =>
    set((state) => ({
      selectedInspectionIds: state.selectedInspectionIds.includes(id)
        ? state.selectedInspectionIds.filter((i) => i !== id)
        : [...state.selectedInspectionIds, id],
    })),

  clearSelection: () => set({ selectedInspectionIds: [] }),

  selectAll: () =>
    set((state) => ({
      selectedInspectionIds: state.inspections.map((i) => i.id),
    })),
}));
