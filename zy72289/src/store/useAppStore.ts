import { create } from 'zustand';
import type { AppStore, DetectedObstacle, HistoryRecord, PointCloudLog } from '@/types';
import {
  initialPointCloudLogs,
  safetyRadiusTable,
  normalLog,
  duplicateNameLog,
  oldCaliberLog,
} from '@/data/mockData';

const generateId = () => Math.random().toString(36).substring(2, 11);

const getCurrentTime = () => new Date().toISOString();

const deepCloneObstacles = (obstacles: DetectedObstacle[]): DetectedObstacle[] =>
  JSON.parse(JSON.stringify(obstacles));

export const useAppStore = create<AppStore>((set, get) => ({
  currentStep: 1,
  pointCloudLogs: initialPointCloudLogs,
  safetyRadiusTable: safetyRadiusTable,
  historyRecords: [],
  activeObstacleId: null,
  scenarioType: null,
  isDemoRunning: false,

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

    set((state) => ({
      pointCloudLogs: [...state.pointCloudLogs, clonedLog],
      historyRecords: [...state.historyRecords, historyRecord],
      scenarioType: scenarioType,
      currentStep: 1,
      isDemoRunning: true,
    }));
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

    set((state) => ({
      pointCloudLogs: state.pointCloudLogs.map((log) =>
        log.id === latestLog.id ? updatedLog : log
      ),
      historyRecords: [...state.historyRecords, historyRecord],
      currentStep: 2,
    }));
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

    set((state) => ({
      pointCloudLogs: state.pointCloudLogs.map((log) =>
        log.id === latestLog.id ? updatedLog : log
      ),
      historyRecords: [...state.historyRecords, historyRecord],
      currentStep: 3,
    }));
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

    set((state) => ({
      pointCloudLogs: state.pointCloudLogs.map((log) =>
        log.id === latestLog.id ? updatedLog : log
      ),
      historyRecords: [...state.historyRecords, historyRecord],
    }));
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

    set((state) => ({
      pointCloudLogs: state.pointCloudLogs.map((log) =>
        log.id === latestLog.id ? updatedLog : log
      ),
      historyRecords: [...state.historyRecords, historyRecord],
    }));
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

    set((state) => ({
      pointCloudLogs: state.pointCloudLogs.map((log) =>
        log.id === latestLog.id ? updatedLog : log
      ),
      historyRecords: [...state.historyRecords, historyRecord],
    }));
  },

  resetDemo: () => {
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
