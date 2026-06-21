import { create } from 'zustand';
import type { AppState, BuoyLog, AnomalyStatus, FilterParams, ImportResult, Anomaly } from '../types';
import { mockBuoys } from '../data/mockBuoys';
import { mockLogs } from '../data/mockLogs';
import { mockAnomalies } from '../data/mockAnomalies';
import { processImportLogs } from '../utils/deduplicator';

const now = Date.now();
const sevenDays = 7 * 24 * 60 * 60 * 1000;

export const useAppStore = create<AppState>((set, get) => ({
  sceneReady: false,
  cameraPosition: [0, 15, 20],
  selectedBuoyId: null,
  selectedAnomalyId: null,
  expandedLogId: null,

  currentTime: now,
  timeRange: [now - sevenDays, now],
  isPlaying: false,
  playbackSpeed: 1,

  filterParams: {
    parameter: 'all',
    riskLevel: 'all',
    status: 'all',
    type: 'all',
    buoyIds: [],
  },

  buoys: mockBuoys,
  logs: mockLogs,
  anomalies: mockAnomalies,

  setSceneReady: (ready) => set({ sceneReady: ready }),

  setCameraPosition: (pos) => set({ cameraPosition: pos }),

  setSelectedBuoy: (id) => set({ selectedBuoyId: id }),

  setSelectedAnomaly: (id) => set({ selectedAnomalyId: id }),

  setExpandedLog: (id) => set({ expandedLogId: id }),

  setCurrentTime: (time, source) => {
    set({ currentTime: time });
    const state = get();
    if (source === 'queue') {
      const anomaly = state.anomalies.find(a => a.id === state.selectedAnomalyId);
      if (anomaly) {
        set({ selectedBuoyId: anomaly.buoyId, expandedLogId: anomaly.logId });
      }
    }
  },

  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setFilter: (filter, source) => {
    set((state) => ({
      filterParams: { ...state.filterParams, ...filter },
    }));
    if (source === 'filter') {
      set({ selectedBuoyId: null, selectedAnomalyId: null });
    }
  },

  importLogs: (newLogs) => {
    const state = get();
    const result = processImportLogs(newLogs, state.logs);

    const existingIds = new Set(state.logs.map((l) => l.id));
    const logsToAdd = result.processedLogs.filter((l) => !existingIds.has(l.id));
    const logsToUpdate = result.processedLogs.filter((l) => existingIds.has(l.id));

    const updatedLogs = state.logs.map((existing) => {
      const update = logsToUpdate.find((u) => u.id === existing.id);
      return update || existing;
    });

    const newAnomalies: Anomaly[] = [];
    for (const log of logsToAdd) {
      for (const anomaly of log.anomalies) {
        if (!state.anomalies.find((a) => a.id === anomaly.id)) {
          newAnomalies.push(anomaly);
        }
      }
    }

    set({
      logs: [...updatedLogs, ...logsToAdd],
      anomalies: [...state.anomalies, ...newAnomalies],
    });

    return result;
  },

  updateLogRemark: (logId, remark) =>
    set((state) => ({
      logs: state.logs.map((log) =>
        log.id === logId ? { ...log, remark } : log
      ),
    })),

  updateAnomalyStatus: (anomalyId, status, note) =>
    set((state) => ({
      anomalies: state.anomalies.map((anomaly) =>
        anomaly.id === anomalyId
          ? {
              ...anomaly,
              status,
              handleNote: note || anomaly.handleNote,
              handler: note ? '老何' : anomaly.handler,
            }
          : anomaly
      ),
    })),

  getLogsByBuoyId: (buoyId) => {
    const state = get();
    return state.logs
      .filter((l) => l.buoyId === buoyId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  getAnomaliesByLogId: (logId) => {
    const state = get();
    return state.anomalies.filter((a) => a.logId === logId);
  },

  getAnomaliesByBuoyId: (buoyId) => {
    const state = get();
    return state.anomalies.filter((a) => a.buoyId === buoyId);
  },

  getFilteredLogs: () => {
    const state = get();
    const { filterParams } = state;
    let logs = [...state.logs];

    if (filterParams.buoyIds.length > 0) {
      logs = logs.filter((l) => filterParams.buoyIds.includes(l.buoyId));
    }

    if (filterParams.timeRange) {
      logs = logs.filter(
        (l) =>
          l.timestamp >= filterParams.timeRange![0] &&
          l.timestamp <= filterParams.timeRange![1]
      );
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp);
  },

  getFilteredAnomalies: () => {
    const state = get();
    const { filterParams } = state;
    let anomalies = [...state.anomalies];

    if (filterParams.riskLevel !== 'all') {
      anomalies = anomalies.filter((a) => a.level === filterParams.riskLevel);
    }

    if (filterParams.status !== 'all') {
      anomalies = anomalies.filter((a) => a.status === filterParams.status);
    }

    if (filterParams.buoyIds.length > 0) {
      anomalies = anomalies.filter((a) =>
        filterParams.buoyIds.includes(a.buoyId)
      );
    }

    if (filterParams.parameter !== 'all') {
      anomalies = anomalies.filter((a) => a.parameter === filterParams.parameter);
    }

    if (filterParams.type !== 'all') {
      anomalies = anomalies.filter((a) => a.type === filterParams.type);
    }

    if (filterParams.timeRange) {
      anomalies = anomalies.filter(
        (a) =>
          a.timestamp >= filterParams.timeRange![0] &&
          a.timestamp <= filterParams.timeRange![1]
      );
    }

    return anomalies.sort((a, b) => b.timestamp - a.timestamp);
  },
}));
