import { create } from 'zustand';
import type {
  AppState,
  AppActions,
  DroneParams,
  WindData,
  PayloadData,
  BatteryStatus,
  Waypoint,
  DataIssue,
  HistoryRecord,
  ChangeItem,
  TabType,
} from '@/types';
import {
  DEFAULT_DRONE_PARAMS,
  DEFAULT_WIND_DATA,
  DEFAULT_PAYLOAD_DATA,
  DEFAULT_BATTERY_STATUS,
  DEFAULT_WAYPOINTS,
  DRONE_MODELS,
} from '@/types';
import { calculateFlightEndurance } from '@/utils/calculator';

interface AppStore extends AppState, AppActions {}

const loadHistoryFromStorage = (): HistoryRecord[] => {
  try {
    const stored = localStorage.getItem('drone_history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveHistoryToStorage = (history: HistoryRecord[]): void => {
  try {
    localStorage.setItem('drone_history', JSON.stringify(history));
  } catch {
    console.error('Failed to save history to storage');
  }
};

export const useAppStore = create<AppStore>((set, get) => ({
  activeTab: 'workspace',
  droneParams: { ...DEFAULT_DRONE_PARAMS },
  windData: { ...DEFAULT_WIND_DATA },
  payloadData: { ...DEFAULT_PAYLOAD_DATA },
  batteryStatus: { ...DEFAULT_BATTERY_STATUS },
  waypoints: [...DEFAULT_WAYPOINTS],
  dataIssues: [],
  calculationResult: null,
  historyRecords: loadHistoryFromStorage(),
  conservativeFactor: 1.2,
  safetyMargin: 15,

  setActiveTab: (tab: TabType) => set({ activeTab: tab }),

  setDroneParams: (params: Partial<DroneParams>) =>
    set((state) => ({
      droneParams: { ...state.droneParams, ...params },
    })),

  setWindData: (data: Partial<WindData>) =>
    set((state) => ({
      windData: { ...state.windData, ...data },
    })),

  setPayloadData: (data: Partial<PayloadData>) =>
    set((state) => {
      const newPayload = { ...state.payloadData, ...data };
      newPayload.totalWeight =
        newPayload.cameraWeight + newPayload.batteryWeight + newPayload.accessoriesWeight;
      return { payloadData: newPayload };
    }),

  setBatteryStatus: (status: Partial<BatteryStatus>) =>
    set((state) => ({
      batteryStatus: { ...state.batteryStatus, ...status },
    })),

  setWaypoints: (waypoints: Waypoint[]) => set({ waypoints }),

  addWaypoint: (waypoint: Waypoint) =>
    set((state) => ({
      waypoints: [...state.waypoints, waypoint],
    })),

  removeWaypoint: (id: string) =>
    set((state) => ({
      waypoints: state.waypoints.filter((wp) => wp.id !== id),
    })),

  setDataIssues: (issues: DataIssue[]) => set({ dataIssues: issues }),

  fixDataIssue: (id: string) =>
    set((state) => ({
      dataIssues: state.dataIssues.map((issue) =>
        issue.id === id ? { ...issue, fixed: true } : issue
      ),
    })),

  calculate: () => {
    const state = get();
    const result = calculateFlightEndurance(
      state.droneParams,
      state.windData,
      state.payloadData,
      state.batteryStatus,
      state.waypoints,
      {
        conservativeFactor: state.conservativeFactor,
        safetyMargin: state.safetyMargin,
      }
    );
    set({ calculationResult: result });
  },

  setConservativeFactor: (factor: number) => set({ conservativeFactor: factor }),

  setSafetyMargin: (margin: number) => set({ safetyMargin: margin }),

  saveToHistory: (author: string, description: string, changes: ChangeItem[]) => {
    const state = get();
    if (!state.calculationResult) return;

    const newRecord: HistoryRecord = {
      id: Math.random().toString(36).substring(2, 11),
      version: state.historyRecords.length + 1,
      timestamp: Date.now(),
      author,
      description,
      changes,
      calculationResult: state.calculationResult,
    };

    const newHistory = [newRecord, ...state.historyRecords];
    set({ historyRecords: newHistory });
    saveHistoryToStorage(newHistory);
  },

  loadFromHistory: (id: string) => {
    const state = get();
    const record = state.historyRecords.find((r) => r.id === id);
    if (record) {
      set({
        droneParams: { ...record.calculationResult.droneParams },
        windData: { ...record.calculationResult.windData },
        payloadData: { ...record.calculationResult.payloadData },
        batteryStatus: { ...record.calculationResult.batteryStatus },
        waypoints: [...record.calculationResult.waypoints],
        calculationResult: record.calculationResult,
      });
    }
  },

  importData: (data: Record<string, unknown>[]) => {
    if (data.length === 0) return;

    const firstRow = data[0];
    
    const droneParams: Partial<DroneParams> = {};
    const windData: Partial<WindData> = {};
    const payloadData: Partial<PayloadData> = {};
    const batteryStatus: Partial<BatteryStatus> = {};
    const waypoints: Waypoint[] = [];

    if (firstRow.model && typeof firstRow.model === 'string') {
      const matchedModel = DRONE_MODELS.find(
        (m) => m.model.toLowerCase() === (firstRow.model as string).toLowerCase()
      );
      if (matchedModel) {
        Object.assign(droneParams, matchedModel);
      }
    }

    Object.entries(firstRow).forEach(([key, value]) => {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      
      if (key.includes('model') || key.includes('型号')) {
        droneParams.model = String(value);
      } else if (key.includes('maxTakeoff') || key.includes('最大起飞')) {
        if (!isNaN(numValue)) droneParams.maxTakeoffWeight = numValue;
      } else if (key.includes('emptyWeight') || key.includes('空机')) {
        if (!isNaN(numValue)) droneParams.emptyWeight = numValue;
      } else if (key.includes('capacity') || key.includes('容量')) {
        if (!isNaN(numValue)) droneParams.batteryCapacity = numValue;
      } else if (key.includes('voltage') || key.includes('电压')) {
        if (!isNaN(numValue)) droneParams.batteryVoltage = numValue;
      } else if (key.includes('flightTime') || key.includes('续航')) {
        if (!isNaN(numValue)) droneParams.maxFlightTime = numValue;
      } else if (key.includes('cruise') || key.includes('巡航')) {
        if (!isNaN(numValue)) droneParams.cruiseSpeed = numValue;
      } else if (key.includes('wind') || key.includes('风速')) {
        if (!isNaN(numValue)) windData.speed = numValue;
      } else if (key.includes('direction') || key.includes('风向')) {
        if (!isNaN(numValue)) windData.direction = numValue;
      } else if (key.includes('flightDir') || key.includes('航向')) {
        if (!isNaN(numValue)) windData.flightDirection = numValue;
      } else if (key.includes('altitude') || key.includes('海拔') || key.includes('高度')) {
        if (!isNaN(numValue)) windData.altitude = numValue;
      } else if (key.includes('camera') || key.includes('相机')) {
        if (!isNaN(numValue)) payloadData.cameraWeight = numValue;
      } else if (key.includes('batteryW') || key.includes('电池重')) {
        if (!isNaN(numValue)) payloadData.batteryWeight = numValue;
      } else if (key.includes('accessory') || key.includes('附件')) {
        if (!isNaN(numValue)) payloadData.accessoriesWeight = numValue;
      } else if (key.includes('total') || key.includes('总重') || key.includes('载重')) {
        if (!isNaN(numValue)) payloadData.totalWeight = numValue;
      } else if (key.includes('currentCap') || key.includes('当前电量')) {
        if (!isNaN(numValue)) batteryStatus.currentCapacity = numValue;
      } else if (key.includes('cycle') || key.includes('循环')) {
        if (!isNaN(numValue)) batteryStatus.cycleCount = numValue;
      } else if (key.includes('temp') || key.includes('温度')) {
        if (!isNaN(numValue)) batteryStatus.temperature = numValue;
      } else if (key.includes('health') || key.includes('健康')) {
        if (!isNaN(numValue)) batteryStatus.health = numValue;
      }
    });

    if (data.length > 1 && (firstRow.lat || firstRow.lng || firstRow.latitude || firstRow.longitude)) {
      data.forEach((row, index) => {
        const lat = parseFloat(String(row.lat || row.latitude || 0));
        const lng = parseFloat(String(row.lng || row.lon || row.longitude || 0));
        if (lat && lng) {
          waypoints.push({
            id: `wp-${index + 1}`,
            lat,
            lng,
            altitude: parseFloat(String(row.altitude || 100)),
            speed: parseFloat(String(row.speed || 12)),
            stayTime: parseFloat(String(row.stayTime || 0)),
          });
        }
      });
    }

    set((state) => ({
      droneParams: { ...state.droneParams, ...droneParams },
      windData: { ...state.windData, ...windData },
      payloadData: { ...state.payloadData, ...payloadData },
      batteryStatus: { ...state.batteryStatus, ...batteryStatus },
      waypoints: waypoints.length > 0 ? waypoints : state.waypoints,
    }));
  },

  reset: () =>
    set({
      droneParams: { ...DEFAULT_DRONE_PARAMS },
      windData: { ...DEFAULT_WIND_DATA },
      payloadData: { ...DEFAULT_PAYLOAD_DATA },
      batteryStatus: { ...DEFAULT_BATTERY_STATUS },
      waypoints: [...DEFAULT_WAYPOINTS],
      dataIssues: [],
      calculationResult: null,
      conservativeFactor: 1.2,
      safetyMargin: 15,
    }),
}));
