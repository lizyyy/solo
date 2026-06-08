import { create } from 'zustand';
import type { AppStore, CurrentStep, DetectedObstacle, HistoryRecord, PointCloudLog, ScenarioType } from '@/types';
import {
  initialPointCloudLogs,
  safetyRadiusTable,
  normalLog,
  duplicateNameLog,
  oldCaliberLog,
} from '@/data/mockData';

const STORAGE_KEY = 'substation-safety-demo-state';

const generateId = () => Math.random().toString(36).substring(2, 11);

const getCurrentTime = () => new Date().toISOString();

const deepCloneObstacles = (obstacles: DetectedObstacle[]): DetectedObstacle[] =>
  JSON.parse(JSON.stringify(obstacles));

interface PersistedState {
  currentStep: number;
  pointCloudLogs: PointCloudLog[];
  historyRecords: HistoryRecord[];
  scenarioType: string | null;
  isDemoRunning: boolean;
}

const loadPersistedState = (): Partial<PersistedState> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return null;
  }
};

const persistState = (state: PersistedState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
};

const clearPersistedState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const saved = loadPersistedState();

export const useAppStore = create<AppStore>((set, get) => ({
  currentStep: (saved?.currentStep as CurrentStep) ?? 1,
  pointCloudLogs: saved?.pointCloudLogs ?? initialPointCloudLogs,
  safetyRadiusTable: safetyRadiusTable,
  historyRecords: saved?.historyRecords ?? [],
  activeObstacleId: null,
  scenarioType: (saved?.scenarioType as ScenarioType) ?? null,
  isDemoRunning: saved?.isDemoRunning ?? false,

  importLog: (scenarioType) => {
    if (!scenarioType) return;

    let logToImport: PointCloudLog;
    switch (scenarioType) {
      case 'normal':
        logToImport = normalLog;
        break;
      case 'duplicate_name':
        logToImport = duplicateNameLog;
        break;
      case 'old_caliber':
        logToImport = oldCaliberLog;
        break;
      default:
        return;
    }

    const clonedLog = JSON.parse(JSON.stringify(logToImport)) as PointCloudLog;
    clonedLog.importTime = getCurrentTime();

    const historyRecord: HistoryRecord = {
      id: generateId(),
      timestamp: getCurrentTime(),
      actionType: 'import_log',
      operator: '园区运维小陶',
      description: `导入点云抽稀日志 - ${clonedLog.deviceName}`,
      affectedObstacleIds: clonedLog.detectedObstacles.map((o) => o.id),
      snapshot: {
        obstacles: deepCloneObstacles(clonedLog.detectedObstacles),
      },
    };

    set((state) => {
      const next = {
        pointCloudLogs: [...state.pointCloudLogs, clonedLog],
        historyRecords: [...state.historyRecords, historyRecord],
        scenarioType: scenarioType,
        currentStep: 1 as const,
        isDemoRunning: true,
      };
      persistState({
        currentStep: next.currentStep,
        pointCloudLogs: next.pointCloudLogs,
        historyRecords: next.historyRecords,
        scenarioType: next.scenarioType,
        isDemoRunning: next.isDemoRunning,
      });
      return next;
    });
  },

  checkRadiusTable: () => {
    const state = get();
    const latestLog = state.pointCloudLogs[state.pointCloudLogs.length - 1];
    if (!latestLog) return;

    const obstaclesToUpdate = latestLog.detectedObstacles.map((obs) => {
      const radiusEntry = state.safetyRadiusTable.find(
        (r) => r.deviceId === obs.deviceId
      );
      if (!radiusEntry) return obs;

      if (obs.detectedRadius !== radiusEntry.newRadius) {
        return {
          ...obs,
          status: 'conflict' as const,
          conflictNote: `日志半径 ${obs.detectedRadius}m 与安全半径表新口径 ${radiusEntry.newRadius}m 不一致`,
          correctedRadius: radiusEntry.newRadius,
        };
      }

      if (obs.status === 'pending_review') {
        return obs;
      }

      return { ...obs, status: 'normal' as const };
    });

    const updatedLog = {
      ...latestLog,
      detectedObstacles: obstaclesToUpdate,
      status: 'reviewed' as const,
    };

    const historyRecord: HistoryRecord = {
      id: generateId(),
      timestamp: getCurrentTime(),
      actionType: 'check_radius',
      operator: '园区运维小陶',
      description: `对照安全半径表核对 - ${latestLog.deviceName}`,
      affectedObstacleIds: obstaclesToUpdate.map((o) => o.id),
      snapshot: {
        obstacles: deepCloneObstacles(obstaclesToUpdate),
      },
    };

    set((state) => {
      const next = {
        pointCloudLogs: state.pointCloudLogs.map((log) =>
          log.id === latestLog.id ? updatedLog : log
        ),
        historyRecords: [...state.historyRecords, historyRecord],
        currentStep: 2 as const,
      };
      persistState({
        currentStep: next.currentStep,
        pointCloudLogs: next.pointCloudLogs,
        historyRecords: next.historyRecords,
        scenarioType: get().scenarioType,
        isDemoRunning: get().isDemoRunning,
      });
      return next;
    });
  },

  updateAnnotation: () => {
    const state = get();
    const latestLog = state.pointCloudLogs[state.pointCloudLogs.length - 1];
    if (!latestLog) return;

    const obstaclesToUpdate = latestLog.detectedObstacles.map((obs) => {
      if (obs.status === 'conflict' && obs.correctedRadius) {
        return {
          ...obs,
          detectedRadius: obs.correctedRadius,
          status: 'normal' as const,
          correctedRadius: undefined,
        };
      }
      if (obs.status === 'pending_review') {
        return obs;
      }
      return obs;
    });

    const updatedLog = {
      ...latestLog,
      detectedObstacles: obstaclesToUpdate,
    };

    const historyRecord: HistoryRecord = {
      id: generateId(),
      timestamp: getCurrentTime(),
      actionType: 'update_annotation',
      operator: '园区运维小陶',
      description: `更新三维标注视图 - ${latestLog.deviceName}`,
      affectedObstacleIds: obstaclesToUpdate.map((o) => o.id),
      snapshot: {
        obstacles: deepCloneObstacles(obstaclesToUpdate),
      },
    };

    set((state) => {
      const next = {
        pointCloudLogs: state.pointCloudLogs.map((log) =>
          log.id === latestLog.id ? updatedLog : log
        ),
        historyRecords: [...state.historyRecords, historyRecord],
        currentStep: 3 as const,
      };
      persistState({
        currentStep: next.currentStep,
        pointCloudLogs: next.pointCloudLogs,
        historyRecords: next.historyRecords,
        scenarioType: get().scenarioType,
        isDemoRunning: get().isDemoRunning,
      });
      return next;
    });
  },

  manualCorrect: (obstacleId, newRadius) => {
    const state = get();
    const latestLog = state.pointCloudLogs[state.pointCloudLogs.length - 1];
    if (!latestLog) return;

    const obstaclesToUpdate = latestLog.detectedObstacles.map((obs) => {
      if (obs.id === obstacleId) {
        return {
          ...obs,
          correctedRadius: newRadius,
          status: 'corrected' as const,
        };
      }
      return obs;
    });

    const updatedLog = {
      ...latestLog,
      detectedObstacles: obstaclesToUpdate,
    };

    const historyRecord: HistoryRecord = {
      id: generateId(),
      timestamp: getCurrentTime(),
      actionType: 'manual_correct',
      operator: '园区运维小陶',
      description: `人工修正安全半径 - 障碍物ID: ${obstacleId}, 新半径: ${newRadius}m`,
      affectedObstacleIds: [obstacleId],
      snapshot: {
        obstacles: deepCloneObstacles(obstaclesToUpdate),
      },
    };

    set((state) => {
      const next = {
        pointCloudLogs: state.pointCloudLogs.map((log) =>
          log.id === latestLog.id ? updatedLog : log
        ),
        historyRecords: [...state.historyRecords, historyRecord],
      };
      persistState({
        currentStep: get().currentStep,
        pointCloudLogs: next.pointCloudLogs,
        historyRecords: next.historyRecords,
        scenarioType: get().scenarioType,
        isDemoRunning: get().isDemoRunning,
      });
      return next;
    });
  },

  markForReview: (obstacleId) => {
    const state = get();
    const latestLog = state.pointCloudLogs[state.pointCloudLogs.length - 1];
    if (!latestLog) return;

    const obstaclesToUpdate = latestLog.detectedObstacles.map((obs) => {
      if (obs.id === obstacleId) {
        return {
          ...obs,
          status: 'pending_review' as const,
        };
      }
      return obs;
    });

    const updatedLog = {
      ...latestLog,
      detectedObstacles: obstaclesToUpdate,
    };

    const historyRecord: HistoryRecord = {
      id: generateId(),
      timestamp: getCurrentTime(),
      actionType: 'mark_review',
      operator: '培训学员',
      description: `标记待复核 - 障碍物ID: ${obstacleId}`,
      affectedObstacleIds: [obstacleId],
      snapshot: {
        obstacles: deepCloneObstacles(obstaclesToUpdate),
      },
    };

    set((state) => {
      const next = {
        pointCloudLogs: state.pointCloudLogs.map((log) =>
          log.id === latestLog.id ? updatedLog : log
        ),
        historyRecords: [...state.historyRecords, historyRecord],
      };
      persistState({
        currentStep: get().currentStep,
        pointCloudLogs: next.pointCloudLogs,
        historyRecords: next.historyRecords,
        scenarioType: get().scenarioType,
        isDemoRunning: get().isDemoRunning,
      });
      return next;
    });
  },

  addManualNote: (obstacleId, note) => {
    const state = get();
    const latestLog = state.pointCloudLogs[state.pointCloudLogs.length - 1];
    if (!latestLog) return;

    const targetObs = latestLog.detectedObstacles.find((o) => o.id === obstacleId);
    if (!targetObs) return;

    const obstaclesToUpdate = latestLog.detectedObstacles.map((obs) => {
      if (obs.id === obstacleId) {
        return {
          ...obs,
          manualNote: note,
        };
      }
      return obs;
    });

    const updatedLog = {
      ...latestLog,
      detectedObstacles: obstaclesToUpdate,
    };

    const historyRecord: HistoryRecord = {
      id: generateId(),
      timestamp: getCurrentTime(),
      actionType: 'add_note',
      operator: '园区运维小陶',
      description: `人工备注 - ${targetObs.name}: ${note}`,
      affectedObstacleIds: [obstacleId],
      snapshot: {
        obstacles: deepCloneObstacles(obstaclesToUpdate),
      },
    };

    set((state) => {
      const next = {
        pointCloudLogs: state.pointCloudLogs.map((log) =>
          log.id === latestLog.id ? updatedLog : log
        ),
        historyRecords: [...state.historyRecords, historyRecord],
      };
      persistState({
        currentStep: get().currentStep,
        pointCloudLogs: next.pointCloudLogs,
        historyRecords: next.historyRecords,
        scenarioType: get().scenarioType,
        isDemoRunning: get().isDemoRunning,
      });
      return next;
    });
  },

  reRun: () => {
    const state = get();
    const latestLog = state.pointCloudLogs[state.pointCloudLogs.length - 1];
    if (!latestLog) return;

    const obstaclesToUpdate = latestLog.detectedObstacles.map((obs) => {
      if (obs.correctedRadius) {
        return {
          ...obs,
          detectedRadius: obs.correctedRadius,
          status: 'normal' as const,
          correctedRadius: undefined,
        };
      }
      return obs;
    });

    const updatedLog = {
      ...latestLog,
      detectedObstacles: obstaclesToUpdate,
      status: 'corrected' as const,
    };

    const historyRecord: HistoryRecord = {
      id: generateId(),
      timestamp: getCurrentTime(),
      actionType: 're_run',
      operator: '园区运维小陶',
      description: `重跑分析 - ${latestLog.deviceName}`,
      affectedObstacleIds: obstaclesToUpdate.map((o) => o.id),
      snapshot: {
        obstacles: deepCloneObstacles(obstaclesToUpdate),
      },
    };

    set((state) => {
      const next = {
        pointCloudLogs: state.pointCloudLogs.map((log) =>
          log.id === latestLog.id ? updatedLog : log
        ),
        historyRecords: [...state.historyRecords, historyRecord],
      };
      persistState({
        currentStep: get().currentStep,
        pointCloudLogs: next.pointCloudLogs,
        historyRecords: next.historyRecords,
        scenarioType: get().scenarioType,
        isDemoRunning: get().isDemoRunning,
      });
      return next;
    });
  },

  resetDemo: () => {
    clearPersistedState();
    set({
      currentStep: 1,
      pointCloudLogs: [],
      historyRecords: [],
      activeObstacleId: null,
      scenarioType: null,
      isDemoRunning: false,
    });
  },

  selectObstacle: (id) => {
    set({ activeObstacleId: id });
  },

  setScenarioType: (type) => {
    set({ scenarioType: type });
  },

  setIsDemoRunning: (running) => {
    set({ isDemoRunning: running });
  },
}));
