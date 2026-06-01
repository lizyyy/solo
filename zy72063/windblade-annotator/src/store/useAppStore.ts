import { create } from 'zustand';
import type { CrackRecord, AppState, AppActions, OperationHistory, Scheme, OperationAction } from '../types';
import { mockRecords, defaultCameraState, getOldVersionRecord3 } from '../data/mockData';
import {
  saveRecords,
  loadRecords,
  saveSchemes,
  loadSchemes,
  saveCameraState,
  loadCameraState,
  saveUIState,
  loadUIState,
  saveActiveScheme,
  loadActiveScheme,
  clearAllStorage
} from '../utils/storage';
import { compareRecords } from '../utils/diff';

const generateId = (): string => Math.random().toString(36).substr(2, 9);
const getTimestamp = (): string => new Date().toISOString().replace('T', ' ').substr(0, 19);

const getInitialState = (): Omit<AppState, keyof AppActions> => {
  const savedRecords = loadRecords();
  const savedSchemes = loadSchemes();
  const savedCamera = loadCameraState();
  const savedUI = loadUIState();
  const savedActiveScheme = loadActiveScheme();

  return {
    records: savedRecords || mockRecords,
    selectedRecordId: savedUI?.selectedRecordId || null,
    cameraState: savedCamera || defaultCameraState,
    schemes: savedSchemes || [],
    activeSchemeId: savedActiveScheme,
    showCompleted: savedUI?.showCompleted ?? true,
    showDiffPanel: false,
    diffRecords: [],
    leftPanelCollapsed: savedUI?.leftPanelCollapsed ?? false,
    rightPanelCollapsed: savedUI?.rightPanelCollapsed ?? false
  };
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...getInitialState(),

  setSelectedRecord: (id) => {
    set({ selectedRecordId: id });
    const state = get();
    saveUIState({
      showCompleted: state.showCompleted,
      leftPanelCollapsed: state.leftPanelCollapsed,
      rightPanelCollapsed: state.rightPanelCollapsed,
      selectedRecordId: id
    });
  },

  setCameraState: (state) => {
    set({ cameraState: state });
    saveCameraState(state);
  },

  updateRecord: (id, updates) => {
    const state = get();
    const record = state.records.find(r => r.id === id);
    if (!record) return;

    const diffs = compareRecords(record, { ...record, ...updates });
    const timestamp = getTimestamp();
    
    const historyEntry: OperationHistory = {
      id: generateId(),
      operator: '何工',
      action: 'update',
      detail: '更新记录信息',
      timestamp,
      diff: diffs.length > 0 ? diffs : undefined
    };

    const updatedRecords = state.records.map(r =>
      r.id === id
        ? { ...r, ...updates, updatedAt: timestamp, history: [...r.history, historyEntry] }
        : r
    );

    set({ records: updatedRecords });
    saveRecords(updatedRecords);
  },

  updateRecordStatus: (id, status) => {
    const state = get();
    const record = state.records.find(r => r.id === id);
    if (!record) return;

    const timestamp = getTimestamp();
    const historyEntry: OperationHistory = {
      id: generateId(),
      operator: '何工',
      action: 'status_change',
      detail: `状态从"${record.status}"改为"${status}"`,
      timestamp,
      diff: [{ field: 'status', oldValue: record.status, newValue: status }]
    };

    const updatedRecords = state.records.map(r =>
      r.id === id
        ? { ...r, status, updatedAt: timestamp, history: [...r.history, historyEntry] }
        : r
    );

    set({ records: updatedRecords });
    saveRecords(updatedRecords);
  },

  addRecord: (record) => {
    const state = get();
    const timestamp = getTimestamp();
    const newRecord: CrackRecord = {
      ...record,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [{
        id: generateId(),
        operator: '何工',
        action: 'create',
        detail: '新建标注记录',
        timestamp
      }]
    };

    const updatedRecords = [...state.records, newRecord];
    set({ records: updatedRecords, selectedRecordId: newRecord.id });
    saveRecords(updatedRecords);
  },

  addRemark: (id, remark, operator = '何工') => {
    const state = get();
    const record = state.records.find(r => r.id === id);
    if (!record) return;

    const timestamp = getTimestamp();
    const oldRemark = record.remark;
    const newRemark = oldRemark ? `${oldRemark}\n\n${operator} ${timestamp}:\n${remark}` : `${operator} ${timestamp}:\n${remark}`;

    const historyEntry: OperationHistory = {
      id: generateId(),
      operator,
      action: 'remark',
      detail: '补充备注信息',
      timestamp,
      diff: [{ field: 'remark', oldValue: oldRemark, newValue: remark }]
    };

    const updatedRecords = state.records.map(r =>
      r.id === id
        ? { ...r, remark: newRemark, updatedAt: timestamp, history: [...r.history, historyEntry] }
        : r
    );

    set({ records: updatedRecords });
    saveRecords(updatedRecords);
  },

  saveScheme: (name, description) => {
    const state = get();
    const timestamp = getTimestamp();
    const newScheme: Scheme = {
      id: generateId(),
      name,
      description,
      records: JSON.parse(JSON.stringify(state.records)),
      cameraState: state.cameraState,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const updatedSchemes = [...state.schemes, newScheme];
    set({ schemes: updatedSchemes, activeSchemeId: newScheme.id });
    saveSchemes(updatedSchemes);
    saveActiveScheme(newScheme.id);
  },

  loadScheme: (schemeId) => {
    const state = get();
    const scheme = state.schemes.find(s => s.id === schemeId);
    if (!scheme) return;

    set({
      records: JSON.parse(JSON.stringify(scheme.records)),
      cameraState: scheme.cameraState,
      activeSchemeId: schemeId
    });

    saveRecords(scheme.records);
    saveCameraState(scheme.cameraState);
    saveActiveScheme(schemeId);
  },

  deleteScheme: (schemeId) => {
    const state = get();
    const updatedSchemes = state.schemes.filter(s => s.id !== schemeId);
    const activeSchemeId = state.activeSchemeId === schemeId ? null : state.activeSchemeId;

    set({ schemes: updatedSchemes, activeSchemeId });
    saveSchemes(updatedSchemes);
    saveActiveScheme(activeSchemeId);
  },

  setShowCompleted: (show) => {
    set({ showCompleted: show });
    const state = get();
    saveUIState({
      showCompleted: show,
      leftPanelCollapsed: state.leftPanelCollapsed,
      rightPanelCollapsed: state.rightPanelCollapsed,
      selectedRecordId: state.selectedRecordId
    });
  },

  toggleDiffPanel: (show) => {
    const state = get();
    const shouldShow = show ?? !state.showDiffPanel;
    
    if (shouldShow && state.diffRecords.length === 0) {
      const oldRecord = getOldVersionRecord3();
      const newRecord = state.records.find(r => r.id === '3');
      if (newRecord) {
        set({ diffRecords: [{ old: oldRecord, new: newRecord }] });
      }
    }
    
    set({ showDiffPanel: shouldShow });
  },

  setDiffRecords: (records) => {
    set({ diffRecords: records });
  },

  toggleLeftPanel: () => {
    const state = get();
    const collapsed = !state.leftPanelCollapsed;
    set({ leftPanelCollapsed: collapsed });
    saveUIState({
      showCompleted: state.showCompleted,
      leftPanelCollapsed: collapsed,
      rightPanelCollapsed: state.rightPanelCollapsed,
      selectedRecordId: state.selectedRecordId
    });
  },

  toggleRightPanel: () => {
    const state = get();
    const collapsed = !state.rightPanelCollapsed;
    set({ rightPanelCollapsed: collapsed });
    saveUIState({
      showCompleted: state.showCompleted,
      leftPanelCollapsed: state.leftPanelCollapsed,
      rightPanelCollapsed: collapsed,
      selectedRecordId: state.selectedRecordId
    });
  },

  importRecords: (records) => {
    const state = get();
    const timestamp = getTimestamp();
    const importedRecords: CrackRecord[] = records.map(r => ({
      ...r,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [{
        id: generateId(),
        operator: '何工',
        action: 'import' as OperationAction,
        detail: '导入外部数据',
        timestamp
      }] as OperationHistory[]
    }));

    const updatedRecords = [...state.records, ...importedRecords];
    set({ records: updatedRecords });
    saveRecords(updatedRecords);
  },

  resetToMockData: () => {
    clearAllStorage();
    set({
      records: mockRecords,
      selectedRecordId: null,
      cameraState: defaultCameraState,
      schemes: [],
      activeSchemeId: null,
      showCompleted: true,
      showDiffPanel: false,
      diffRecords: [],
      leftPanelCollapsed: false,
      rightPanelCollapsed: false
    });
  }
}));

export const useSelectedRecord = () => {
  const { selectedRecordId, records } = useAppStore();
  return records.find(r => r.id === selectedRecordId) || null;
};

export const useFilteredRecords = () => {
  const { records, showCompleted } = useAppStore();
  if (showCompleted) return records;
  return records.filter(r => r.status !== 'completed');
};

export const useRecordsByStatus = () => {
  const records = useFilteredRecords();
  return {
    pending: records.filter(r => r.status === 'pending'),
    processing: records.filter(r => r.status === 'processing'),
    completed: records.filter(r => r.status === 'completed'),
    confirmed: records.filter(r => r.status === 'confirmed')
  };
};
