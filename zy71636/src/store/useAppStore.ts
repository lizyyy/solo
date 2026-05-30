import { create } from 'zustand';
import {
  Crack,
  Sensor,
  StressPoint,
  HistoryRecord,
  FilterState,
  ViewState,
  SelectedObject,
} from '../types';
import {
  mockCracks,
  mockSensors,
  mockStressPoints,
  mockHistoryRecords,
} from '../data/mockData';

interface AppState {
  filters: FilterState;
  selectedObject: SelectedObject | null;
  view: ViewState;
  cracks: Crack[];
  sensors: Sensor[];
  stressPoints: StressPoint[];
  historyRecords: HistoryRecord[];
  setFilters: (filters: Partial<FilterState>) => void;
  selectObject: (obj: SelectedObject | null) => void;
  toggleLayer: (layer: keyof ViewState['visibleLayers']) => void;
  setViewMode: (mode: ViewState['viewMode']) => void;
  getFilteredCracks: () => Crack[];
  getFilteredSensors: () => Sensor[];
  getFilteredStressPoints: () => StressPoint[];
  confirmObjectManually: (
    type: 'crack' | 'sensor',
    id: string,
    operator: string,
    notes: string
  ) => void;
}

const now = new Date();
const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

export const useAppStore = create<AppState>((set, get) => ({
  filters: {
    timeRange: [oneMonthAgo.toISOString(), now.toISOString()],
    dataTypes: ['crack', 'sensor', 'stress'],
    severityLevel: ['critical', 'warning', 'normal'],
    sensorStatus: ['normal', 'warning', 'alarm', 'offline'],
    showBoundaryIssues: true,
  },
  selectedObject: null,
  view: {
    viewMode: 'perspective',
    visibleLayers: {
      dam: true,
      cracks: true,
      sensors: true,
      stress: true,
    },
  },
  cracks: mockCracks,
  sensors: mockSensors,
  stressPoints: mockStressPoints,
  historyRecords: mockHistoryRecords,

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  selectObject: (obj) => set({ selectedObject: obj }),

  toggleLayer: (layer) =>
    set((state) => ({
      view: {
        ...state.view,
        visibleLayers: {
          ...state.view.visibleLayers,
          [layer]: !state.view.visibleLayers[layer],
        },
      },
    })),

  setViewMode: (mode) =>
    set((state) => ({
      view: { ...state.view, viewMode: mode },
    })),

  getFilteredCracks: () => {
    const { filters, cracks } = get();
    if (!filters.dataTypes.includes('crack')) return [];

    return cracks.filter((crack) => {
      if (!filters.severityLevel.includes(crack.severity)) return false;
      if (!filters.showBoundaryIssues && crack.hasBoundaryIssue) return false;
      const crackDate = new Date(crack.updatedAt);
      const startDate = new Date(filters.timeRange[0]);
      const endDate = new Date(filters.timeRange[1]);
      if (crackDate < startDate || crackDate > endDate) return false;
      return true;
    });
  },

  getFilteredSensors: () => {
    const { filters, sensors } = get();
    if (!filters.dataTypes.includes('sensor')) return [];

    return sensors.filter((sensor) => {
      if (!filters.sensorStatus.includes(sensor.status)) return false;
      if (!filters.showBoundaryIssues && sensor.hasBreakpoint) return false;
      const readingDate = new Date(sensor.lastReading);
      const startDate = new Date(filters.timeRange[0]);
      const endDate = new Date(filters.timeRange[1]);
      if (readingDate < startDate || readingDate > endDate) return false;
      return true;
    });
  },

  getFilteredStressPoints: () => {
    const { filters, stressPoints } = get();
    if (!filters.dataTypes.includes('stress')) return [];

    return stressPoints.filter((point) => {
      const levelMap: Record<string, string> = {
        low: 'normal',
        medium: 'normal',
        high: 'warning',
        critical: 'critical',
      };
      if (!filters.severityLevel.includes(levelMap[point.level])) return false;
      const measureDate = new Date(point.measuredAt);
      const startDate = new Date(filters.timeRange[0]);
      const endDate = new Date(filters.timeRange[1]);
      if (measureDate < startDate || measureDate > endDate) return false;
      return true;
    });
  },

  confirmObjectManually: (type, id, operator, notes) => {
    const timestamp = new Date().toISOString();
    const confirmation = { operator, timestamp, notes };

    if (type === 'crack') {
      set((state) => ({
        cracks: state.cracks.map((crack) =>
          crack.id === id
            ? { ...crack, manualConfirmed: confirmation, hasBoundaryIssue: false }
            : crack
        ),
        historyRecords: [
          ...state.historyRecords,
          {
            id: `hist-${Date.now()}`,
            targetType: 'crack',
            targetId: id,
            changeType: 'manual_confirm',
            beforeValue: '未确认/有边界问题',
            afterValue: '已人工确认',
            reason: notes,
            operator,
            manualConfirmed: true,
            createdAt: timestamp,
          },
        ],
      }));
    } else if (type === 'sensor') {
      set((state) => ({
        sensors: state.sensors.map((sensor) =>
          sensor.id === id
            ? { ...sensor, manualConfirmed: confirmation, hasBreakpoint: false }
            : sensor
        ),
        historyRecords: [
          ...state.historyRecords,
          {
            id: `hist-${Date.now()}`,
            targetType: 'sensor',
            targetId: id,
            changeType: 'manual_confirm',
            beforeValue: '未确认/有断点',
            afterValue: '已人工确认',
            reason: notes,
            operator,
            manualConfirmed: true,
            createdAt: timestamp,
          },
        ],
      }));
    }
  },
}));
