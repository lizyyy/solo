import { create } from 'zustand';
import {
  mockWarehouse,
  mockRobots,
  mockTrajectories,
  mockPathSegments,
  mockOrderWaves,
  mockCongestionReports,
} from '../mock';
import type {
  Warehouse,
  Robot,
  TrajectoryPoint,
  PathSegment,
  OrderWave,
  CongestionReport,
  Shelf,
  Floor,
  ChargingStation,
  Zone,
  DataSourceStatus,
  DataQualityIssue,
} from '../types';

interface DataState {
  warehouse: Warehouse | null;
  robots: Robot[];
  trajectories: TrajectoryPoint[];
  pathSegments: PathSegment[];
  orderWaves: OrderWave[];
  congestionReports: CongestionReport[];
  isLoading: boolean;
  error: string | null;
  lastSyncTime: number | null;
}

interface DataStore extends DataState {
  loadData: () => Promise<void>;
  reloadData: () => Promise<void>;
  getFloorById: (floorId: string) => Floor | undefined;
  getShelfById: (shelfId: string) => Shelf | undefined;
  getRobotById: (robotId: string) => Robot | undefined;
  getStationById: (stationId: string) => ChargingStation | undefined;
  getZoneById: (zoneId: string) => Zone | undefined;
  getTrajectoriesByRobotId: (robotId: string) => TrajectoryPoint[];
  getPathSegmentById: (segmentId: string) => PathSegment | undefined;
  getPathSegmentsByRobotId: (robotId: string) => PathSegment[];
  getCongestionByShelfId: (shelfId: string) => CongestionReport[];
  getShelvesByFloor: (floorLevel: number) => Shelf[];
  getStationsByFloor: (floorLevel: number) => ChargingStation[];
  getZonesByFloor: (floorLevel: number) => Zone[];
  getDataSourceStatus: () => DataSourceStatus[];
  getDataQualityIssues: () => DataQualityIssue[];
  updateShelf: (shelfId: string, updates: Partial<Shelf>) => void;
  updateRobot: (robotId: string, updates: Partial<Robot>) => void;
  updateStation: (stationId: string, updates: Partial<ChargingStation>) => void;
  updateCongestionReport: (reportId: string, updates: Partial<CongestionReport>) => void;
}

const getInitialState = (): DataState => ({
  warehouse: null,
  robots: [],
  trajectories: [],
  pathSegments: [],
  orderWaves: [],
  congestionReports: [],
  isLoading: false,
  error: null,
  lastSyncTime: null,
});

export const useDataStore = create<DataStore>((set, get) => ({
  ...getInitialState(),

  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      set({
        warehouse: mockWarehouse,
        robots: mockRobots,
        trajectories: mockTrajectories,
        pathSegments: mockPathSegments,
        orderWaves: mockOrderWaves,
        congestionReports: mockCongestionReports,
        isLoading: false,
        lastSyncTime: Date.now(),
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '数据加载失败',
      });
    }
  },

  reloadData: async () => {
    await get().loadData();
  },

  getFloorById: (floorId) => {
    const { warehouse } = get();
    return warehouse?.floors.find((f) => f.id === floorId);
  },

  getShelfById: (shelfId) => {
    const { warehouse } = get();
    if (!warehouse) return undefined;
    for (const floor of warehouse.floors) {
      const shelf = floor.shelves.find((s) => s.id === shelfId);
      if (shelf) return shelf;
    }
    return undefined;
  },

  getRobotById: (robotId) => {
    return get().robots.find((r) => r.id === robotId);
  },

  getStationById: (stationId) => {
    const { warehouse } = get();
    if (!warehouse) return undefined;
    for (const floor of warehouse.floors) {
      const station = floor.chargingStations.find((s) => s.id === stationId);
      if (station) return station;
    }
    return undefined;
  },

  getZoneById: (zoneId) => {
    const { warehouse } = get();
    if (!warehouse) return undefined;
    for (const floor of warehouse.floors) {
      const zone = floor.zones.find((z) => z.id === zoneId);
      if (zone) return zone;
    }
    return undefined;
  },

  getTrajectoriesByRobotId: (robotId) => {
    return get().trajectories.filter((t) => t.robotId === robotId);
  },

  getPathSegmentById: (segmentId) => {
    return get().pathSegments.find((s) => s.id === segmentId);
  },

  getPathSegmentsByRobotId: (robotId) => {
    return get().pathSegments.filter((s) => s.robotId === robotId);
  },

  getCongestionByShelfId: (shelfId) => {
    return get().congestionReports.filter((c) => c.shelfId === shelfId);
  },

  getShelvesByFloor: (floorLevel) => {
    const { warehouse } = get();
    return warehouse?.floors.find((f) => f.level === floorLevel)?.shelves ?? [];
  },

  getStationsByFloor: (floorLevel) => {
    const { warehouse } = get();
    return warehouse?.floors.find((f) => f.level === floorLevel)?.chargingStations ?? [];
  },

  getZonesByFloor: (floorLevel) => {
    const { warehouse } = get();
    return warehouse?.floors.find((f) => f.level === floorLevel)?.zones ?? [];
  },

  getDataSourceStatus: () => {
    const state = get();
    const now = Date.now();

    return [
      {
        type: 'warehouse' as const,
        name: '仓库模型数据',
        isConnected: state.warehouse !== null,
        lastSyncTime: state.lastSyncTime ?? now,
        recordCount: state.warehouse ? 1 : 0,
        qualityScore: 98,
        issues: [],
      },
      {
        type: 'trajectory' as const,
        name: '机器人轨迹数据',
        isConnected: state.trajectories.length > 0,
        lastSyncTime: state.lastSyncTime ?? now,
        recordCount: state.trajectories.length,
        qualityScore: 85,
        issues: state.trajectories.filter((t) => t.isBreakpoint).map((t) => ({
          id: `issue-traj-${t.id}`,
          type: 'trajectory_break' as const,
          severity: 'warning' as const,
          entityType: 'trajectory',
          entityId: t.id,
          description: `轨迹点 ${t.id} 存在断点`,
          canFix: true,
        })),
      },
      {
        type: 'shelf' as const,
        name: '货架数据',
        isConnected: state.warehouse !== null,
        lastSyncTime: state.lastSyncTime ?? now,
        recordCount: state.warehouse?.floors.reduce((sum, f) => sum + f.shelves.length, 0) ?? 0,
        qualityScore: 92,
        issues: state.warehouse?.floors.flatMap((f) =>
          f.shelves
            .filter((s) => s.isMissingData)
            .map((s) => ({
              id: `issue-shelf-${s.id}`,
              type: 'missing_field' as const,
              severity: 'error' as const,
              entityType: 'shelf',
              entityId: s.id,
              fieldName: 'skuList',
              description: `货架 ${s.id} 缺少SKU数据`,
              canFix: true,
            }))
        ) ?? [],
      },
      {
        type: 'order' as const,
        name: '订单波次数据',
        isConnected: state.orderWaves.length > 0,
        lastSyncTime: state.lastSyncTime ?? now,
        recordCount: state.orderWaves.length,
        qualityScore: 90,
        issues: state.orderWaves
          .filter((w) => !w.isDataComplete)
          .map((w) => ({
            id: `issue-wave-${w.id}`,
            type: 'missing_field' as const,
            severity: 'warning' as const,
            entityType: 'order',
            entityId: w.id,
            description: `波次 ${w.name} 数据不完整`,
            canFix: false,
          })),
      },
      {
        type: 'charging' as const,
        name: '充电排队数据',
        isConnected: state.warehouse !== null,
        lastSyncTime: state.lastSyncTime ?? now,
        recordCount: state.warehouse?.floors.reduce(
          (sum, f) => sum + f.chargingStations.reduce((s, st) => s + st.queue.length, 0),
          0
        ) ?? 0,
        qualityScore: 88,
        issues: state.warehouse?.floors.flatMap((f) =>
          f.chargingStations.flatMap((st) =>
            st.queue
              .filter((q) => q.isDuplicate)
              .map((q) => ({
                id: `issue-queue-${q.id}`,
                type: 'duplicate_queue' as const,
                severity: 'info' as const,
                entityType: 'charging',
                entityId: q.id,
                description: `排队记录 ${q.id} 存在重复`,
                canFix: true,
              }))
          )
        ) ?? [],
      },
      {
        type: 'congestion' as const,
        name: '拥堵报告数据',
        isConnected: state.congestionReports.length > 0,
        lastSyncTime: state.lastSyncTime ?? now,
        recordCount: state.congestionReports.length,
        qualityScore: 95,
        issues: [],
      },
    ];
  },

  getDataQualityIssues: () => {
    const statuses = get().getDataSourceStatus();
    return statuses.flatMap((s) => s.issues);
  },

  updateShelf: (shelfId, updates) => {
    set((state) => {
      if (!state.warehouse) return state;
      return {
        warehouse: {
          ...state.warehouse,
          floors: state.warehouse.floors.map((floor) => ({
            ...floor,
            shelves: floor.shelves.map((shelf) =>
              shelf.id === shelfId ? { ...shelf, ...updates } : shelf
            ),
          })),
        },
      };
    });
  },

  updateRobot: (robotId, updates) => {
    set((state) => ({
      robots: state.robots.map((robot) =>
        robot.id === robotId ? { ...robot, ...updates } : robot
      ),
    }));
  },

  updateStation: (stationId, updates) => {
    set((state) => {
      if (!state.warehouse) return state;
      return {
        warehouse: {
          ...state.warehouse,
          floors: state.warehouse.floors.map((floor) => ({
            ...floor,
            chargingStations: floor.chargingStations.map((station) =>
              station.id === stationId ? { ...station, ...updates } : station
            ),
          })),
        },
      };
    });
  },

  updateCongestionReport: (reportId, updates) => {
    set((state) => ({
      congestionReports: state.congestionReports.map((report) =>
        report.id === reportId ? { ...report, ...updates } : report
      ),
    }));
  },
}));
