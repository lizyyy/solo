import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppStore, ProcessRecord, PointStatus } from '@/types';
import { generateId } from '@/utils/algorithm';
import { generateSampleData } from '@/data/sampleData';

const initialSampleData = generateSampleData();

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      busStops: initialSampleData.busStops,
      dataSources: initialSampleData.dataSources,
      processRecords: initialSampleData.processRecords,
      selectedBusStopId: null,
      filters: {},

      setSelectedBusStop: (id: string | null) => {
        set({ selectedBusStopId: id });
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      confirmBusStop: (id: string, remark?: string) => {
        set((state) => {
          const busStop = state.busStops.find((b) => b.id === id);
          if (!busStop) return state;

          const newRecord: ProcessRecord = {
            id: generateId(),
            busStopId: id,
            action: 'confirm',
            operator: '老曹',
            remark,
            timestamp: new Date().toISOString(),
            beforeState: { status: busStop.status },
            afterState: { status: 'confirmed' as PointStatus, needsReview: false },
          };

          return {
            busStops: state.busStops.map((b) =>
              b.id === id
                ? { ...b, status: 'confirmed', needsReview: false, updatedAt: new Date().toISOString() }
                : b
            ),
            processRecords: [...state.processRecords, newRecord],
          };
        });
      },

      markAsException: (id: string, remark?: string) => {
        set((state) => {
          const busStop = state.busStops.find((b) => b.id === id);
          if (!busStop) return state;

          const newRecord: ProcessRecord = {
            id: generateId(),
            busStopId: id,
            action: 'exception',
            operator: '老曹',
            remark,
            timestamp: new Date().toISOString(),
            beforeState: { status: busStop.status },
            afterState: { status: 'exception' as PointStatus },
          };

          return {
            busStops: state.busStops.map((b) =>
              b.id === id
                ? { ...b, status: 'exception', updatedAt: new Date().toISOString() }
                : b
            ),
            processRecords: [...state.processRecords, newRecord],
          };
        });
      },

      mergeBusStops: (sourceId: string, targetId: string, remark?: string) => {
        set((state) => {
          const source = state.busStops.find((b) => b.id === sourceId);
          const target = state.busStops.find((b) => b.id === targetId);
          if (!source || !target) return state;

          const newRecord: ProcessRecord = {
            id: generateId(),
            busStopId: sourceId,
            action: 'merge',
            operator: '老曹',
            remark: remark || `归并到: ${target.name}`,
            timestamp: new Date().toISOString(),
            beforeState: { status: source.status },
            afterState: { status: 'merged' as PointStatus, mergedIntoId: targetId },
          };

          return {
            busStops: state.busStops.map((b) => {
              if (b.id === sourceId) {
                return {
                  ...b,
                  status: 'merged',
                  mergedIntoId: targetId,
                  updatedAt: new Date().toISOString(),
                };
              }
              if (b.id === targetId) {
                return {
                  ...b,
                  mergedIds: [...b.mergedIds, sourceId],
                  updatedAt: new Date().toISOString(),
                };
              }
              return b;
            }),
            processRecords: [...state.processRecords, newRecord],
          };
        });
      },

      unmergeBusStop: (id: string, remark?: string) => {
        set((state) => {
          const busStop = state.busStops.find((b) => b.id === id);
          if (!busStop || busStop.status !== 'merged' || !busStop.mergedIntoId) return state;

          const targetId = busStop.mergedIntoId;

          const newRecord: ProcessRecord = {
            id: generateId(),
            busStopId: id,
            action: 'unmerge',
            operator: '老曹',
            remark,
            timestamp: new Date().toISOString(),
            beforeState: { status: busStop.status },
            afterState: { status: 'pending' as PointStatus, mergedIntoId: undefined },
          };

          return {
            busStops: state.busStops.map((b) => {
              if (b.id === id) {
                return {
                  ...b,
                  status: 'pending',
                  mergedIntoId: undefined,
                  updatedAt: new Date().toISOString(),
                };
              }
              if (b.id === targetId) {
                return {
                  ...b,
                  mergedIds: b.mergedIds.filter((mid) => mid !== id),
                  updatedAt: new Date().toISOString(),
                };
              }
              return b;
            }),
            processRecords: [...state.processRecords, newRecord],
          };
        });
      },

      addNote: (id: string, notes: string) => {
        set((state) => {
          const busStop = state.busStops.find((b) => b.id === id);
          if (!busStop) return state;

          const newRecord: ProcessRecord = {
            id: generateId(),
            busStopId: id,
            action: 'update',
            operator: '老曹',
            remark: '更新备注信息',
            timestamp: new Date().toISOString(),
            beforeState: { notes: busStop.notes },
            afterState: { notes },
          };

          return {
            busStops: state.busStops.map((b) =>
              b.id === id ? { ...b, notes, updatedAt: new Date().toISOString() } : b
            ),
            processRecords: [...state.processRecords, newRecord],
          };
        });
      },

      exportData: () => {
        const state = get();
        const exportData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          busStops: state.busStops,
          dataSources: state.dataSources,
          processRecords: state.processRecords,
        };
        return JSON.stringify(exportData, null, 2);
      },

      importData: (jsonStr: string) => {
        try {
          const data = JSON.parse(jsonStr);
          if (data.busStops && data.dataSources && data.processRecords) {
            set({
              busStops: data.busStops,
              dataSources: data.dataSources,
              processRecords: data.processRecords,
              selectedBusStopId: null,
              filters: {},
            });
          }
        } catch (e) {
          console.error('Import failed:', e);
        }
      },

      resetWithSampleData: () => {
        const sampleData = generateSampleData();
        set({
          busStops: sampleData.busStops,
          dataSources: sampleData.dataSources,
          processRecords: sampleData.processRecords,
          selectedBusStopId: null,
          filters: {},
        });
      },

      getDataSourceByBusStopId: (busStopId: string) => {
        return get().dataSources.filter((ds) => ds.busStopId === busStopId);
      },

      getProcessRecordsByBusStopId: (busStopId: string) => {
        return get()
          .processRecords.filter((pr) => pr.busStopId === busStopId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },
    }),
    {
      name: 'bus-stop-assessment-store',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export const useFilteredBusStops = () => {
  const { busStops, filters } = useStore();
  
  return busStops.filter((stop) => {
    if (filters.status && stop.status !== filters.status) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        stop.name.toLowerCase().includes(searchLower) ||
        stop.standardizedName.toLowerCase().includes(searchLower) ||
        (stop.address && stop.address.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });
};

export const useBusStopStats = () => {
  const { busStops } = useStore();
  
  return {
    total: busStops.length,
    pending: busStops.filter((b) => b.status === 'pending').length,
    confirmed: busStops.filter((b) => b.status === 'confirmed').length,
    exception: busStops.filter((b) => b.status === 'exception').length,
    merged: busStops.filter((b) => b.status === 'merged').length,
    needsReview: busStops.filter((b) => b.needsReview).length,
    boundary: busStops.filter((b) => b.isBoundary).length,
  };
};
