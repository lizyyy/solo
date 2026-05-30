import { create } from 'zustand';
import type {
  ArrayConfig,
  ShadowConfig,
  PVModule,
  Obstacle,
  AnalysisRecord,
  ShadingResult,
  PowerResult,
  Filters,
  BatchInfo,
  RecordStatus,
  DataQuality,
  ConnectionType,
} from '../types';
import { calculateAllShading } from '../utils/shadingCalculator';
import { calculateArrayPower } from '../utils/powerCalculator';
import { detectAnomalies, getDataQuality } from '../utils/anomalyDetector';

interface AppState {
  arrayConfig: ArrayConfig;
  shadowConfig: ShadowConfig;
  shadingResults: ShadingResult[];
  powerResults: PowerResult[];
  totalPower: number;
  totalLoss: number;
  records: AnalysisRecord[];
  filteredRecords: AnalysisRecord[];
  filters: Filters;
  batches: BatchInfo[];
  currentBatchId: string;

  setArrayConfig: (config: Partial<ArrayConfig>) => void;
  setConnectionType: (type: ConnectionType) => void;
  setBypassDiode: (enabled: boolean) => void;
  setSunAngle: (altitude: number, azimuth: number) => void;
  addObstacle: (obstacle: Obstacle) => void;
  removeObstacle: (id: string) => void;
  updateObstacle: (id: string, updates: Partial<Obstacle>) => void;
  clearObstacles: () => void;

  calculateResults: () => void;

  addRecord: (status?: RecordStatus, remarks?: string) => void;
  updateRecord: (id: string, updates: Partial<AnalysisRecord>) => void;
  withdrawRecord: (id: string) => void;
  supplementRecord: (id: string, remarks?: string) => void;

  setFilters: (filters: Partial<Filters>) => void;
  updateFilteredRecords: () => void;

  createNewBatch: (name?: string) => void;
  generateReport: () => Promise<void>;

  initializeMockData: () => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function createDefaultArrayConfig(): ArrayConfig {
  const rows = 3;
  const cols = 4;
  const modules: PVModule[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      modules.push({
        id: `module-${row}-${col}`,
        position: { row, col },
        ratedPower: 300,
        efficiency: 21.5,
        bypassDiode: true,
        diodeCount: 3,
      });
    }
  }

  return {
    rows,
    cols,
    connectionType: 'series',
    seriesPerString: rows * cols,
    parallelStrings: 1,
    modules,
  };
}

function createDefaultShadowConfig(): ShadowConfig {
  return {
    sunAltitude: 45,
    sunAzimuth: 180,
    obstacles: [],
  };
}

function createDefaultFilters(): Filters {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    dateRange: [weekAgo.toISOString(), today.toISOString()],
    status: ['normal', 'supplement'],
    quality: ['normal', 'pending', 'anomaly'],
    batchId: '',
  };
}

export const useStore = create<AppState>((set, get) => ({
  arrayConfig: createDefaultArrayConfig(),
  shadowConfig: createDefaultShadowConfig(),
  shadingResults: [],
  powerResults: [],
  totalPower: 0,
  totalLoss: 0,
  records: [],
  filteredRecords: [],
  filters: createDefaultFilters(),
  batches: [],
  currentBatchId: '',

  setArrayConfig: (config) => {
    set((state) => {
      const newConfig = { ...state.arrayConfig, ...config };
      if (config.rows !== undefined || config.cols !== undefined) {
        const modules: PVModule[] = [];
        for (let row = 0; row < newConfig.rows; row++) {
          for (let col = 0; col < newConfig.cols; col++) {
            modules.push({
              id: `module-${row}-${col}`,
              position: { row, col },
              ratedPower: 300,
              efficiency: 21.5,
              bypassDiode: newConfig.modules?.[0]?.bypassDiode ?? true,
              diodeCount: 3,
            });
          }
        }
        newConfig.modules = modules;
      }
      return { arrayConfig: newConfig };
    });
    get().calculateResults();
  },

  setConnectionType: (type) => {
    set((state) => {
      const config = { ...state.arrayConfig, connectionType: type };
      const total = config.rows * config.cols;

      if (type === 'series') {
        config.seriesPerString = total;
        config.parallelStrings = 1;
      } else if (type === 'parallel') {
        config.seriesPerString = 1;
        config.parallelStrings = total;
      } else {
        config.seriesPerString = config.rows;
        config.parallelStrings = config.cols;
      }

      return { arrayConfig: config };
    });
    get().calculateResults();
  },

  setBypassDiode: (enabled) => {
    set((state) => ({
      arrayConfig: {
        ...state.arrayConfig,
        modules: state.arrayConfig.modules.map((m) => ({ ...m, bypassDiode: enabled })),
      },
    }));
    get().calculateResults();
  },

  setSunAngle: (altitude, azimuth) => {
    set((state) => ({
      shadowConfig: {
        ...state.shadowConfig,
        sunAltitude: altitude,
        sunAzimuth: azimuth,
      },
    }));
    get().calculateResults();
  },

  addObstacle: (obstacle) => {
    set((state) => ({
      shadowConfig: {
        ...state.shadowConfig,
        obstacles: [...state.shadowConfig.obstacles, obstacle],
      },
    }));
    get().calculateResults();
  },

  removeObstacle: (id) => {
    set((state) => ({
      shadowConfig: {
        ...state.shadowConfig,
        obstacles: state.shadowConfig.obstacles.filter((o) => o.id !== id),
      },
    }));
    get().calculateResults();
  },

  updateObstacle: (id, updates) => {
    set((state) => ({
      shadowConfig: {
        ...state.shadowConfig,
        obstacles: state.shadowConfig.obstacles.map((o) =>
          o.id === id ? { ...o, ...updates } : o
        ),
      },
    }));
    get().calculateResults();
  },

  clearObstacles: () => {
    set((state) => ({
      shadowConfig: {
        ...state.shadowConfig,
        obstacles: [],
      },
    }));
    get().calculateResults();
  },

  calculateResults: () => {
    const { arrayConfig, shadowConfig } = get();
    const shadingResults = calculateAllShading(
      arrayConfig.modules,
      shadowConfig.obstacles,
      {
        altitude: shadowConfig.sunAltitude,
        azimuth: shadowConfig.sunAzimuth,
      }
    );

    const { powerResults, totalPower, totalLoss } = calculateArrayPower(
      arrayConfig,
      shadingResults
    );

    set({ shadingResults, powerResults, totalPower, totalLoss });
  },

  addRecord: (status = 'normal', remarks = '') => {
    const {
      arrayConfig,
      shadowConfig,
      shadingResults,
      powerResults,
      totalPower,
      totalLoss,
      records,
      currentBatchId,
    } = get();

    const now = new Date();
    const timestamp = now.getTime();

    const record: AnalysisRecord = {
      id: generateId(),
      batchId: currentBatchId,
      timestamp,
      status,
      quality: 'normal',
      arrayConfig: JSON.parse(JSON.stringify(arrayConfig)),
      shadowConfig: JSON.parse(JSON.stringify(shadowConfig)),
      shadingResults: JSON.parse(JSON.stringify(shadingResults)),
      powerResults: JSON.parse(JSON.stringify(powerResults)),
      totalPower,
      totalLoss,
      anomalyFlags: [],
      remarks,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const anomalies = detectAnomalies(record, records);
    record.anomalyFlags = anomalies.map((a) => a.type);
    record.quality = getDataQuality(anomalies);

    const newRecords = [...records, record];
    set({ records: newRecords });
    get().updateFilteredRecords();
  },

  updateRecord: (id, updates) => {
    set((state) => {
      const newRecords = state.records.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
      );
      return { records: newRecords };
    });
    get().updateFilteredRecords();
  },

  withdrawRecord: (id) => {
    get().updateRecord(id, { status: 'withdrawn' });
  },

  supplementRecord: (id, remarks = '') => {
    const { records } = get();
    const original = records.find((r) => r.id === id);
    if (original) {
      const now = new Date();
      const record: AnalysisRecord = {
        ...original,
        id: generateId(),
        status: 'supplement',
        timestamp: now.getTime(),
        remarks: remarks || `补录 - 原记录 ${id}`,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      set((state) => ({ records: [...state.records, record] }));
      get().updateFilteredRecords();
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
    get().updateFilteredRecords();
  },

  updateFilteredRecords: () => {
    const { records, filters } = get();
    const [startDate, endDate] = filters.dateRange;

    const filtered = records.filter((record) => {
      const inDateRange =
        record.timestamp >= new Date(startDate).getTime() &&
        record.timestamp <= new Date(endDate).getTime();

      const matchStatus = filters.status.includes(record.status);
      const matchQuality = filters.quality.includes(record.quality);
      const matchBatch = !filters.batchId || record.batchId === filters.batchId;

      return inDateRange && matchStatus && matchQuality && matchBatch;
    });

    set({ filteredRecords: filtered });
  },

  createNewBatch: (name) => {
    const now = new Date();
    const batchId = `B${String(get().batches.length + 1).padStart(3, '0')}`;

    const batch: BatchInfo = {
      id: batchId,
      name: name || `教学批次 ${batchId}`,
      recordCount: 0,
      createdAt: now.toISOString(),
      status: 'draft',
    };

    set((state) => ({
      batches: [...state.batches, batch],
      currentBatchId: batchId,
    }));
  },

  generateReport: async () => {
    const { generateReport } = await import('../utils/reportGenerator');
    const { batches, currentBatchId, records } = get();

    const currentBatch = batches.find((b) => b.id === currentBatchId);
    if (!currentBatch) return;

    const batchRecords = records.filter((r) => r.batchId === currentBatchId);
    await generateReport(currentBatch, batchRecords, 'report-content');
  },

  initializeMockData: () => {
    const batchId = 'B001';
    const now = new Date();
    const baseTime = now.getTime();

    const batch: BatchInfo = {
      id: batchId,
      name: '光伏教学演示 - 5月30日',
      recordCount: 8,
      createdAt: now.toISOString(),
      status: 'draft',
    };

    const baseConfig = createDefaultArrayConfig();
    const baseShadow = createDefaultShadowConfig();

    const createObstacle = (
      x: number,
      y: number,
      w: number,
      h: number
    ): Obstacle => ({
      id: generateId(),
      type: 'rectangle',
      position: { x, y },
      size: { width: w, height: h },
      opacity: 0.8,
    });

    const mockRecords: AnalysisRecord[] = [
      {
        id: generateId(),
        batchId,
        timestamp: baseTime - 7200000,
        status: 'normal',
        quality: 'normal',
        arrayConfig: { ...baseConfig, connectionType: 'series' },
        shadowConfig: { ...baseShadow, sunAltitude: 60, obstacles: [] },
        shadingResults: baseConfig.modules.map((m) => ({
          moduleId: m.id,
          shadingRate: 0,
          affectedCells: [],
        })),
        powerResults: baseConfig.modules.map((m) => ({
          timestamp: baseTime - 7200000,
          moduleId: m.id,
          actualPower: 300,
          theoreticalPower: 300,
          lossRate: 0,
          lossReason: 'other',
          bypassDiodeActive: false,
        })),
        totalPower: 3600,
        totalLoss: 0,
        anomalyFlags: [],
        remarks: '无遮挡 - 串联配置',
        createdAt: new Date(baseTime - 7200000).toISOString(),
        updatedAt: new Date(baseTime - 7200000).toISOString(),
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime - 6600000,
        status: 'normal',
        quality: 'normal',
        arrayConfig: { ...baseConfig, connectionType: 'series' },
        shadowConfig: {
          ...baseShadow,
          sunAltitude: 55,
          obstacles: [createObstacle(80, 40, 60, 40)],
        },
        shadingResults: baseConfig.modules.map((m, i) => ({
          moduleId: m.id,
          shadingRate: i < 2 ? 0.4 : 0,
          affectedCells: i < 2 ? [0, 1, 2] : [],
        })),
        powerResults: baseConfig.modules.map((m, i) => ({
          timestamp: baseTime - 6600000,
          moduleId: m.id,
          actualPower: i < 2 ? 192 : 300,
          theoreticalPower: 300,
          lossRate: i < 2 ? 36 : 0,
          lossReason: i < 2 ? 'shading' : 'other',
          bypassDiodeActive: i < 2,
        })),
        totalPower: 2304,
        totalLoss: 1296,
        anomalyFlags: [],
        remarks: '部分遮挡 - 旁路二极管导通',
        createdAt: new Date(baseTime - 6600000).toISOString(),
        updatedAt: new Date(baseTime - 6600000).toISOString(),
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime - 6000000,
        status: 'normal',
        quality: 'normal',
        arrayConfig: { ...baseConfig, connectionType: 'parallel' },
        shadowConfig: {
          ...baseShadow,
          sunAltitude: 50,
          obstacles: [createObstacle(80, 40, 60, 40)],
        },
        shadingResults: baseConfig.modules.map((m, i) => ({
          moduleId: m.id,
          shadingRate: i < 2 ? 0.4 : 0,
          affectedCells: i < 2 ? [0, 1, 2] : [],
        })),
        powerResults: baseConfig.modules.map((m, i) => ({
          timestamp: baseTime - 6000000,
          moduleId: m.id,
          actualPower: i < 2 ? 192 : 300,
          theoreticalPower: 300,
          lossRate: i < 2 ? 36 : 0,
          lossReason: i < 2 ? 'shading' : 'other',
          bypassDiodeActive: false,
        })),
        totalPower: 3384,
        totalLoss: 216,
        anomalyFlags: [],
        remarks: '并联配置 - 对比串联损失',
        createdAt: new Date(baseTime - 6000000).toISOString(),
        updatedAt: new Date(baseTime - 6000000).toISOString(),
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime - 5400000,
        status: 'supplement',
        quality: 'normal',
        arrayConfig: { ...baseConfig, connectionType: 'series' },
        shadowConfig: {
          ...baseShadow,
          sunAltitude: 45,
          obstacles: [createObstacle(80, 40, 60, 40), createObstacle(200, 100, 80, 50)],
        },
        shadingResults: baseConfig.modules.map((m, i) => ({
          moduleId: m.id,
          shadingRate: i < 4 ? 0.6 : 0.2,
          affectedCells: i < 4 ? [0, 1, 2, 3, 4] : [0],
        })),
        powerResults: baseConfig.modules.map((m, i) => ({
          timestamp: baseTime - 5400000,
          moduleId: m.id,
          actualPower: i < 4 ? 120 : 252,
          theoreticalPower: 300,
          lossRate: i < 4 ? 60 : 16,
          lossReason: 'shading',
          bypassDiodeActive: i < 4,
        })),
        totalPower: 1488,
        totalLoss: 2112,
        anomalyFlags: [],
        remarks: '晚补记录 - 多重遮挡实验',
        createdAt: new Date(baseTime - 5400000).toISOString(),
        updatedAt: new Date(baseTime - 5400000).toISOString(),
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime - 3600000,
        status: 'normal',
        quality: 'pending',
        arrayConfig: { ...baseConfig, connectionType: 'series' },
        shadowConfig: { ...baseShadow, sunAltitude: 30, obstacles: [] },
        shadingResults: baseConfig.modules.map((m) => ({
          moduleId: m.id,
          shadingRate: 0,
          affectedCells: [],
        })),
        powerResults: baseConfig.modules.map((m) => ({
          timestamp: baseTime - 3600000,
          moduleId: m.id,
          actualPower: 280,
          theoreticalPower: 300,
          lossRate: 6.67,
          lossReason: 'other',
          bypassDiodeActive: false,
        })),
        totalPower: 3360,
        totalLoss: 240,
        anomalyFlags: ['SHADOW_TIME_ERROR'],
        remarks: '待确认 - 时间接近傍晚',
        createdAt: new Date(baseTime - 3600000).toISOString(),
        updatedAt: new Date(baseTime - 3600000).toISOString(),
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime - 1800000,
        status: 'normal',
        quality: 'anomaly',
        arrayConfig: {
          ...baseConfig,
          connectionType: 'series',
          seriesPerString: 20,
          parallelStrings: 3,
        },
        shadowConfig: { ...baseShadow, sunAltitude: 40, obstacles: [] },
        shadingResults: baseConfig.modules.map((m) => ({
          moduleId: m.id,
          shadingRate: 0,
          affectedCells: [],
        })),
        powerResults: baseConfig.modules.map((m) => ({
          timestamp: baseTime - 1800000,
          moduleId: m.id,
          actualPower: 290,
          theoreticalPower: 300,
          lossRate: 3.33,
          lossReason: 'other',
          bypassDiodeActive: false,
        })),
        totalPower: 3480,
        totalLoss: 120,
        anomalyFlags: ['CONNECTION_MISMATCH'],
        remarks: '串并联参数配置错误',
        createdAt: new Date(baseTime - 1800000).toISOString(),
        updatedAt: new Date(baseTime - 1800000).toISOString(),
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime - 900000,
        status: 'withdrawn',
        quality: 'normal',
        arrayConfig: { ...baseConfig, connectionType: 'series' },
        shadowConfig: { ...baseShadow, sunAltitude: 50, obstacles: [] },
        shadingResults: baseConfig.modules.map((m) => ({
          moduleId: m.id,
          shadingRate: 0,
          affectedCells: [],
        })),
        powerResults: baseConfig.modules.map((m) => ({
          timestamp: baseTime - 900000,
          moduleId: m.id,
          actualPower: 295,
          theoreticalPower: 300,
          lossRate: 1.67,
          lossReason: 'other',
          bypassDiodeActive: false,
        })),
        totalPower: 3540,
        totalLoss: 60,
        anomalyFlags: [],
        remarks: '已撤回 - 测试数据无效',
        createdAt: new Date(baseTime - 900000).toISOString(),
        updatedAt: new Date(baseTime - 600000).toISOString(),
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime,
        status: 'duplicate',
        quality: 'pending',
        arrayConfig: { ...baseConfig, connectionType: 'parallel' },
        shadowConfig: {
          ...baseShadow,
          sunAltitude: 50,
          obstacles: [createObstacle(80, 40, 60, 40)],
        },
        shadingResults: baseConfig.modules.map((m, i) => ({
          moduleId: m.id,
          shadingRate: i < 2 ? 0.4 : 0,
          affectedCells: i < 2 ? [0, 1, 2] : [],
        })),
        powerResults: baseConfig.modules.map((m, i) => ({
          timestamp: baseTime,
          moduleId: m.id,
          actualPower: i < 2 ? 192 : 300,
          theoreticalPower: 300,
          lossRate: i < 2 ? 36 : 0,
          lossReason: i < 2 ? 'shading' : 'other',
          bypassDiodeActive: false,
        })),
        totalPower: 3384,
        totalLoss: 216,
        anomalyFlags: ['DUPLICATE_SUBMISSION'],
        remarks: '重复提交 - 备注已修改',
        createdAt: new Date(baseTime).toISOString(),
        updatedAt: new Date(baseTime).toISOString(),
      },
    ];

    set({
      batches: [batch],
      currentBatchId: batchId,
      records: mockRecords,
      filteredRecords: mockRecords.filter((r) => r.status !== 'withdrawn'),
    });

    get().calculateResults();
  },
}));
