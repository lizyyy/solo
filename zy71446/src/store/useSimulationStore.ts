import { create } from 'zustand';
import { CrowdDataPoint, DeviceStatus, PeakHourConfig } from '../types/simulation';
import { Anomaly, ConflictLog } from '../types/anomalies';
import { Escalator, Turnstile } from '../types/devices';
import { zones, escalators as escalatorsConfig, turnstiles as turnstilesConfig, peakHourConfig } from '../data/stationConfig';
import { mockAnomalies, mockConflictLogs } from '../data/mockHistory';
import { CrowdEngine } from '../engine/CrowdEngine';
import { AnomalyDetector } from '../engine/AnomalyDetector';
import { ConflictResolver } from '../engine/ConflictResolver';
import { addMinutesToTime, timeToMinutes, minutesToTime } from '../utils/timeUtils';

interface CrowdDistributionData {
  zoneId: string;
  currentCount: number;
  maxCapacity: number;
  density: number;
  flowIn: number;
  flowOut: number;
}

interface SimulationStore {
  currentTime: string;
  isPlaying: boolean;
  playSpeed: number;
  startTime: string;
  endTime: string;
  peakHourConfig: PeakHourConfig;

  crowdData: Map<string, CrowdDataPoint>;
  crowdDistribution: Map<string, CrowdDistributionData>;
  deviceStatuses: DeviceStatus[];
  escalators: Escalator[];
  turnstiles: Turnstile[];

  activeAnomalies: Anomaly[];
  conflictLogs: ConflictLog[];

  crowdEngine: CrowdEngine;
  anomalyDetector: AnomalyDetector;
  conflictResolver: ConflictResolver;

  setTime: (time: string) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  stepForward: (minutes: number) => void;
  tick: () => void;

  acknowledgeAnomaly: (id: string) => void;
  resolveAnomaly: (id: string, notes: string) => void;
  resolveConflict: (id: string, decision: string, notes?: string, operator?: string) => void;

  updateSimulation: (time: string) => void;
  loadMockData: () => void;
}

const initialTime = '07:00';
const crowdEngine = new CrowdEngine();
const anomalyDetector = new AnomalyDetector();
const conflictResolver = new ConflictResolver();

mockConflictLogs.forEach((log) => {
  conflictResolver['conflictLogs'].push(log);
});

const initialDeviceStatuses: DeviceStatus[] = [
  ...escalatorsConfig.map((e) => ({
    deviceId: e.id,
    status: e.direction,
    throughput: e.direction !== 'stopped' ? 30 : 0,
    direction: e.direction,
    timestamp: initialTime,
  })),
  ...turnstilesConfig.map((t) => ({
    deviceId: t.id,
    status: t.status,
    throughput: t.status === 'open' ? t.throughput : 0,
    timestamp: initialTime,
  })),
];

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  currentTime: initialTime,
  isPlaying: false,
  playSpeed: 1,
  startTime: '07:00',
  endTime: '09:30',
  peakHourConfig,

  crowdData: new Map(),
  crowdDistribution: new Map(),
  deviceStatuses: initialDeviceStatuses,
  escalators: escalatorsConfig,
  turnstiles: turnstilesConfig,

  activeAnomalies: mockAnomalies.filter((a) => a.status === 'active'),
  conflictLogs: mockConflictLogs,

  crowdEngine,
  anomalyDetector,
  conflictResolver,

  setTime: (time: string) => {
    set({ currentTime: time });
    get().updateSimulation(time);
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  setPlaySpeed: (speed: number) => {
    set({ playSpeed: speed });
  },

  stepForward: (minutes: number) => {
    const state = get();
    const newTime = addMinutesToTime(state.currentTime, minutes);
    const endMinutes = timeToMinutes(state.endTime);
    const newMinutes = timeToMinutes(newTime);

    if (newMinutes <= endMinutes) {
      get().setTime(newTime);
    } else {
      set({ isPlaying: false });
    }
  },

  tick: () => {
    const state = get();
    if (!state.isPlaying) return;

    const stepMinutes = state.playSpeed;
    state.stepForward(stepMinutes);
  },

  acknowledgeAnomaly: (id: string) => {
    set((state) => ({
      activeAnomalies: state.activeAnomalies.map((a) =>
        a.id === id ? { ...a, status: 'acknowledged' as const } : a
      ),
    }));
  },

  resolveAnomaly: (id: string, notes: string) => {
    set((state) => ({
      activeAnomalies: state.activeAnomalies.map((a) =>
        a.id === id
          ? { ...a, status: 'resolved' as const, endTime: state.currentTime, resolutionNotes: notes }
          : a
      ),
    }));
  },

  resolveConflict: (id: string, decision: string, notes?: string, operator?: string) => {
    const state = get();
    if (decision === 'auto') {
      const conflict = state.conflictResolver.getConflictById(id);
      if (conflict) {
        state.conflictResolver.autoResolve(conflict);
        set({
          conflictLogs: state.conflictResolver.getConflictLogs(),
        });
      }
    } else {
      const result = state.conflictResolver.manualResolve(id, decision, operator || '系统', notes || '');
      if (result) {
        set({
          conflictLogs: state.conflictResolver.getConflictLogs(),
        });
      }
    }
  },

  updateSimulation: (time: string) => {
    const state = get();

    let crowdData = state.crowdEngine.computeCrowdDistribution(time);

    const currentMinutes = timeToMinutes(time);
    if (currentMinutes >= timeToMinutes('08:05') && currentMinutes <= timeToMinutes('08:20')) {
      crowdData = state.crowdEngine.injectAnomaly(time, 'over_capacity', 'concourse_main');
    }
    if (currentMinutes >= timeToMinutes('08:20') && currentMinutes <= timeToMinutes('08:35')) {
      crowdData = state.crowdEngine.injectAnomaly(time, 'reflow', 'corridor_main');
    }

    crowdData.forEach((data) => {
      state.crowdEngine.updateHistoricalData(time, data);
    });

    const deviceStatuses = state.deviceStatuses.map((d) => ({
      ...d,
      timestamp: time,
    }));

    const detectionResult = state.anomalyDetector.detectAll(
      crowdData,
      deviceStatuses,
      time,
      state.activeAnomalies
    );

    if (detectionResult.hasDataConflict && detectionResult.conflictData) {
      const cd = detectionResult.conflictData as any;
      const confidence = cd.confidence || { concourse: 0.85, turnstile: 0.92, escalator: 0.8 };
      state.conflictResolver.logConflict(
        'capacity_data_conflict',
        {
          concourse: cd.concourse,
          turnstile: cd.turnstile,
          escalator: cd.escalator,
        },
        confidence,
        time,
        detectionResult.anomalies.find((a) => a.type === 'data_conflict')?.id
      );
    }

    const existingIds = new Set(state.activeAnomalies.map((a) => a.id));
    const newAnomalies = detectionResult.anomalies.filter((a) => !existingIds.has(a.id));
    const updatedAnomalies = [...state.activeAnomalies, ...newAnomalies].filter(
      (a) => a.status !== 'resolved' || a.endTime
    );

    const crowdDistribution = new Map<string, CrowdDistributionData>();
    crowdData.forEach((data, zoneId) => {
      const zone = zones.find((z) => z.id === zoneId);
      crowdDistribution.set(zoneId, {
        zoneId,
        currentCount: data.count,
        maxCapacity: zone?.capacity || 100,
        density: data.density,
        flowIn: data.flowIn,
        flowOut: data.flowOut,
      });
    });

    set({
      crowdData,
      crowdDistribution,
      deviceStatuses,
      activeAnomalies: updatedAnomalies,
      conflictLogs: state.conflictResolver.getConflictLogs(),
    });
  },

  loadMockData: () => {
    const state = get();
    state.updateSimulation(state.currentTime);
  },
}));
