import { create } from 'zustand';
import type {
  TransitWindow,
  Conflict,
  HistoryRecord,
  DataSource,
  ViewState,
  ImportData,
  ImportResult,
  TimeSource,
  WindowStatus
} from '@/types';
import { STORAGE_KEYS, SATELLITE_COLORS } from '@/types';
import { saveToStorage, loadFromStorage } from '@/utils/storage';
import { generateId, getDefaultViewRange } from '@/utils/timeUtils';
import { detectAllConflicts } from '@/services/overlapService';
import { processImportData, createImportResult } from '@/services/importService';
import { createHistoryRecord } from '@/services/historyService';
import { generateBriefingData, exportBriefingJSON, exportBriefingPDF } from '@/services/exportService';

interface AppState {
  windows: TransitWindow[];
  conflicts: Conflict[];
  history: HistoryRecord[];
  dataSources: DataSource[];
  view: ViewState;
  selectedWindowId: string | null;
  selectedConflictId: string | null;
  isImportModalOpen: boolean;
  isExportModalOpen: boolean;
  isHistoryModalOpen: boolean;
  isSidePanelOpen: boolean;
  lastSavedAt: string | null;

  setWindows: (windows: TransitWindow[]) => void;
  addWindow: (window: Omit<TransitWindow, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateWindow: (id: string, updates: Partial<TransitWindow>) => void;
  deleteWindow: (id: string) => void;

  importData: (data: ImportData) => ImportResult;
  detectConflicts: () => void;
  resolveConflict: (conflictId: string, resolution: string) => void;

  setView: (view: Partial<ViewState>) => void;
  setViewRange: (startTime: string, endTime: string) => void;
  setFilters: (filters: Partial<ViewState['filters']>) => void;
  selectWindow: (id: string | null) => void;
  selectConflict: (id: string | null) => void;

  openImportModal: () => void;
  closeImportModal: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  toggleSidePanel: () => void;

  exportBriefing: (format: 'PDF' | 'JSON') => void;

  persist: () => void;
  load: () => void;
  reset: () => void;
}

const defaultView: ViewState = {
  ...getDefaultViewRange(),
  zoom: 1,
  panX: 0,
  filters: {
    satellites: [],
    statuses: [],
    timeSources: []
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  windows: [],
  conflicts: [],
  history: [],
  dataSources: [],
  view: defaultView,
  selectedWindowId: null,
  selectedConflictId: null,
  isImportModalOpen: false,
  isExportModalOpen: false,
  isHistoryModalOpen: false,
  isSidePanelOpen: true,
  lastSavedAt: null,

  setWindows: (windows) => {
    set({ windows });
    get().detectConflicts();
    get().persist();
  },

  addWindow: (windowData) => {
    const newWindow: TransitWindow = {
      ...windowData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const historyRecord = createHistoryRecord(
      'CREATE',
      'WINDOW',
      newWindow.id,
      null,
      newWindow,
      '手动创建窗口'
    );
    
    set((state) => ({
      windows: [...state.windows, newWindow],
      history: [...state.history, historyRecord]
    }));
    
    get().detectConflicts();
    get().persist();
  },

  updateWindow: (id, updates) => {
    const state = get();
    const oldWindow = state.windows.find(w => w.id === id);
    if (!oldWindow) return;
    
    const newWindow = { ...oldWindow, ...updates, updatedAt: new Date().toISOString() };
    const historyRecord = createHistoryRecord(
      'UPDATE',
      'WINDOW',
      id,
      oldWindow,
      newWindow,
      '更新窗口信息'
    );
    
    set((s) => ({
      windows: s.windows.map(w => w.id === id ? newWindow : w),
      history: [...s.history, historyRecord]
    }));
    
    get().detectConflicts();
    get().persist();
  },

  deleteWindow: (id) => {
    const state = get();
    const oldWindow = state.windows.find(w => w.id === id);
    if (!oldWindow) return;
    
    const historyRecord = createHistoryRecord(
      'DELETE',
      'WINDOW',
      id,
      oldWindow,
      null,
      '删除窗口'
    );
    
    set((s) => ({
      windows: s.windows.filter(w => w.id !== id),
      conflicts: s.conflicts.filter(c => c.windowId1 !== id && c.windowId2 !== id),
      history: [...s.history, historyRecord],
      selectedWindowId: s.selectedWindowId === id ? null : s.selectedWindowId
    }));
    
    get().persist();
  },

  importData: (data) => {
    const state = get();
    const { windows: newWindows, dataSource, warnings } = processImportData(data, state.windows);
    
    const allWindows = [...state.windows, ...newWindows];
    const conflicts = detectAllConflicts(allWindows);
    
    const historyRecord = createHistoryRecord(
      'IMPORT',
      'WINDOW',
      dataSource.id,
      null,
      { dataSource, importedCount: newWindows.length },
      `导入数据源: ${data.name}`
    );
    
    const updatedWindows = newWindows.map(w => ({
      ...w,
      status: conflicts.some(c => c.windowId1 === w.id || c.windowId2 === w.id) ? 'CONFLICT' as WindowStatus : 'NORMAL' as WindowStatus
    }));
    
    set((s) => ({
      windows: [...s.windows, ...updatedWindows],
      conflicts,
      dataSources: [...s.dataSources, dataSource],
      history: [...s.history, historyRecord]
    }));
    
    get().persist();
    
    return createImportResult(true, dataSource.id, newWindows.length, conflicts, warnings);
  },

  detectConflicts: () => {
    const state = get();
    const conflicts = detectAllConflicts(state.windows);
    
    const conflictWindowIds = new Set<string>();
    conflicts.forEach(c => {
      conflictWindowIds.add(c.windowId1);
      if (c.windowId2) conflictWindowIds.add(c.windowId2);
    });
    
    const updatedWindows = state.windows.map(w => ({
      ...w,
      status: conflictWindowIds.has(w.id) ? 'CONFLICT' as WindowStatus : 'NORMAL' as WindowStatus
    }));
    
    set({ conflicts, windows: updatedWindows });
  },

  resolveConflict: (conflictId, resolution) => {
    const state = get();
    const conflict = state.conflicts.find(c => c.id === conflictId);
    if (!conflict) return;
    
    const updatedConflict = { ...conflict, status: 'RESOLVED' as const };
    const historyRecord = createHistoryRecord(
      'RESOLVE',
      'CONFLICT',
      conflictId,
      conflict,
      updatedConflict,
      resolution
    );
    
    set((s) => ({
      conflicts: s.conflicts.map(c => c.id === conflictId ? updatedConflict : c),
      history: [...s.history, historyRecord]
    }));
    
    get().persist();
  },

  setView: (viewUpdates) => {
    set((state) => ({
      view: { ...state.view, ...viewUpdates }
    }));
  },

  setViewRange: (startTime, endTime) => {
    set((state) => ({
      view: { ...state.view, startTime, endTime }
    }));
    get().persist();
  },

  setFilters: (filters) => {
    set((state) => ({
      view: { ...state.view, filters: { ...state.view.filters, ...filters } }
    }));
  },

  selectWindow: (id) => {
    set({ selectedWindowId: id, selectedConflictId: null });
  },

  selectConflict: (id) => {
    set({ selectedConflictId: id });
  },

  openImportModal: () => set({ isImportModalOpen: true }),
  closeImportModal: () => set({ isImportModalOpen: false }),
  openExportModal: () => set({ isExportModalOpen: true }),
  closeExportModal: () => set({ isExportModalOpen: false }),
  openHistoryModal: () => set({ isHistoryModalOpen: true }),
  closeHistoryModal: () => set({ isHistoryModalOpen: false }),
  toggleSidePanel: () => set((state) => ({ isSidePanelOpen: !state.isSidePanelOpen })),

  exportBriefing: (format) => {
    const state = get();
    const briefing = generateBriefingData(state.windows, state.conflicts, state.view);
    
    if (format === 'JSON') {
      exportBriefingJSON(briefing);
    } else {
      exportBriefingPDF(briefing);
    }
    
    const historyRecord = createHistoryRecord(
      'EXPORT',
      'SETTINGS',
      'briefing',
      null,
      { format, viewRange: briefing.viewRange },
      `导出任务简报 (${format})`
    );
    
    set((s) => ({
      history: [...s.history, historyRecord]
    }));
    
    get().persist();
  },

  persist: () => {
    const state = get();
    saveToStorage(STORAGE_KEYS.WINDOWS, state.windows);
    saveToStorage(STORAGE_KEYS.CONFLICTS, state.conflicts);
    saveToStorage(STORAGE_KEYS.HISTORY, state.history);
    saveToStorage(STORAGE_KEYS.DATA_SOURCES, state.dataSources);
    saveToStorage(STORAGE_KEYS.VIEW_STATE, state.view);
    set({ lastSavedAt: new Date().toISOString() });
  },

  load: () => {
    const windows = loadFromStorage<TransitWindow[]>(STORAGE_KEYS.WINDOWS, []);
    const conflicts = loadFromStorage<Conflict[]>(STORAGE_KEYS.CONFLICTS, []);
    const history = loadFromStorage<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    const dataSources = loadFromStorage<DataSource[]>(STORAGE_KEYS.DATA_SOURCES, []);
    const view = loadFromStorage<ViewState>(STORAGE_KEYS.VIEW_STATE, defaultView);
    
    set({ windows, conflicts, history, dataSources, view });
  },

  reset: () => {
    set({
      windows: [],
      conflicts: [],
      history: [],
      dataSources: [],
      view: defaultView,
      selectedWindowId: null,
      selectedConflictId: null
    });
    get().persist();
  }
}));
