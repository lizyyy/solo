import { create } from 'zustand';
import type { BaseRecord, HistoryEntry, Exhibit, Route, RecordFilter, ImportResult, Conflict, RoutePoint, RecordStatus, RecordSource } from '@/types';
import { mockRecords, mockExhibits, mockRoutes, mockHistory } from '@/data/mockData';
import { generateId, pointToRectDistance } from '@/utils/helpers';
import { parseFilePackage } from '@/utils/fileParser';

interface AppState {
  records: BaseRecord[];
  exhibits: Exhibit[];
  routes: Route[];
  history: HistoryEntry[];
  currentRoute: Route | null;
  filters: RecordFilter;
  selectedRecordId: string | null;
  isImporting: boolean;
  lastImportResult: ImportResult | null;
  currentUser: string;

  setFilters: (filters: Partial<RecordFilter>) => void;
  selectRecord: (id: string | null) => void;
  addRecord: (record: BaseRecord) => void;
  updateRecord: (id: string, updates: Partial<BaseRecord>, reason: string) => void;
  updateRecordStatus: (id: string, status: RecordStatus, reason: string) => void;
  importPackage: (files: File[]) => Promise<ImportResult>;
  confirmImport: (records: BaseRecord[]) => void;
  setCurrentRoute: (routeId: string) => void;
  addRoutePoint: (x: number, y: number) => void;
  removeRoutePoint: (pointId: string) => void;
  updateRoutePoint: (pointId: string, x: number, y: number) => void;
  saveRoute: (name: string) => void;
  detectConflicts: () => Conflict[];
  loadMockData: () => void;
  getRecordHistory: (recordId: string) => HistoryEntry[];
}

export const useAppStore = create<AppState>((set, get) => ({
  records: [],
  exhibits: [],
  routes: [],
  history: [],
  currentRoute: null,
  filters: {},
  selectedRecordId: null,
  isImporting: false,
  lastImportResult: null,
  currentUser: '当前用户',

  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),

  selectRecord: (id) => set({ selectedRecordId: id }),

  addRecord: (record) => set((state) => ({ records: [...state.records, record] })),

  updateRecord: (id, updates, reason) =>
    set((state) => {
      const record = state.records.find((r) => r.id === id);
      if (!record) return state;

      const newHistory: HistoryEntry[] = [];
      Object.entries(updates).forEach(([key, value]) => {
        const oldValue = key in record.content 
          ? record.content[key as keyof typeof record.content]
          : (record as any)[key];
        
        if (oldValue !== value) {
          newHistory.push({
            id: generateId(),
            recordId: id,
            fieldName: key,
            oldValue,
            newValue: value,
            modifiedBy: state.currentUser,
            modifiedAt: new Date().toISOString(),
            reason,
          });
        }
      });

      const isContentUpdate = Object.keys(updates).some(k => k in record.content);
      let updatedRecord = { ...record, ...updates, updatedAt: new Date().toISOString() };
      
      if (isContentUpdate) {
        const contentUpdates: typeof record.content = {};
        const otherUpdates: Partial<BaseRecord> = {};
        
        Object.entries(updates).forEach(([key, value]) => {
          if (key in record.content) {
            (contentUpdates as any)[key] = value;
          } else {
            (otherUpdates as any)[key] = value;
          }
        });
        
        updatedRecord = {
          ...record,
          ...otherUpdates,
          content: { ...record.content, ...contentUpdates },
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        records: state.records.map((r) => (r.id === id ? updatedRecord : r)),
        history: [...state.history, ...newHistory],
      };
    }),

  updateRecordStatus: (id, status, reason) => {
    get().updateRecord(id, { status } as Partial<BaseRecord>, reason);
  },

  importPackage: async (files) => {
    set({ isImporting: true });
    try {
      const result = await parseFilePackage(files);
      set({ isImporting: false, lastImportResult: result });
      return result;
    } catch (error) {
      set({ isImporting: false });
      throw error;
    }
  },

  confirmImport: (records) =>
    set((state) => {
      const now = new Date().toISOString();
      const recordsWithUser = records.map((r) => ({
        ...r,
        modifiedBy: state.currentUser,
        createdAt: now,
        updatedAt: now,
      }));
      return {
        records: [...state.records, ...recordsWithUser],
        lastImportResult: null,
      };
    }),

  setCurrentRoute: (routeId) =>
    set((state) => ({
      currentRoute: state.routes.find((r) => r.id === routeId) || null,
    })),

  addRoutePoint: (x, y) =>
    set((state) => {
      if (!state.currentRoute) return state;
      const newPoint: RoutePoint = {
        id: generateId(),
        x,
        y,
        order: state.currentRoute.points.length,
      };
      return {
        currentRoute: {
          ...state.currentRoute,
          points: [...state.currentRoute.points, newPoint],
        },
      };
    }),

  removeRoutePoint: (pointId) =>
    set((state) => {
      if (!state.currentRoute) return state;
      const newPoints = state.currentRoute.points
        .filter((p) => p.id !== pointId)
        .map((p, i) => ({ ...p, order: i }));
      return {
        currentRoute: { ...state.currentRoute, points: newPoints },
      };
    }),

  updateRoutePoint: (pointId, x, y) =>
    set((state) => {
      if (!state.currentRoute) return state;
      return {
        currentRoute: {
          ...state.currentRoute,
          points: state.currentRoute.points.map((p) =>
            p.id === pointId ? { ...p, x, y } : p
          ),
        },
      };
    }),

  saveRoute: (name) =>
    set((state) => {
      if (!state.currentRoute) return state;
      
      const oldRoute = state.routes.find((r) => r.isActive);
      let version = 1;
      
      const newRoute: Route = {
        ...state.currentRoute,
        id: generateId(),
        name,
        version,
        isActive: true,
        createdAt: new Date().toISOString(),
        modifiedBy: state.currentUser,
      };

      if (oldRoute) {
        version = oldRoute.version + 1;
        newRoute.version = version;
      }

      const updatedRoutes = state.routes
        .map((r) => ({ ...r, isActive: false }))
        .concat(newRoute);

      return {
        routes: updatedRoutes,
        currentRoute: newRoute,
      };
    }),

  detectConflicts: () => {
    const { currentRoute, exhibits } = get();
    if (!currentRoute) return [];

    const conflicts: Conflict[] = [];
    const CONFLICT_THRESHOLD = 15;

    currentRoute.points.forEach((point) => {
      exhibits.forEach((exhibit) => {
        const distance = pointToRectDistance(
          point.x, point.y,
          exhibit.x, exhibit.y,
          exhibit.width, exhibit.height
        );
        if (distance < CONFLICT_THRESHOLD) {
          conflicts.push({
            routePointId: point.id,
            exhibitId: exhibit.id,
            exhibitName: exhibit.name,
            distance,
          });
        }
      });
    });

    return conflicts;
  },

  loadMockData: () =>
    set(() => ({
      records: mockRecords,
      exhibits: mockExhibits,
      routes: mockRoutes,
      history: mockHistory,
      currentRoute: mockRoutes.find((r) => r.isActive) || null,
    })),

  getRecordHistory: (recordId) => {
    return get().history.filter((h) => h.recordId === recordId);
  },
}));
