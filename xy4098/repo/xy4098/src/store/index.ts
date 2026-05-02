import { create } from 'zustand';
import type { Floor, Sensor, WorkOrder, Thresholds, Alert, TimeRange, InspectionSuggestion } from '../types';

interface AppState {
  floors: Floor[];
  sensors: Sensor[];
  workOrders: WorkOrder[];
  thresholds: Thresholds;
  alerts: Alert[];
  inspectionSuggestions: InspectionSuggestion[];
  selectedFloorId: string | null;
  selectedSensorId: string | null;
  selectedZoneId: string | null;
  currentTime: number;
  timeRange: TimeRange;
  isPlaying: boolean;
  playSpeed: number;
  cameraRotation: number;
  cameraElevation: number;
  isLoading: boolean;
  error: string | null;
  setFloors: (floors: Floor[]) => void;
  setSensors: (sensors: Sensor[]) => void;
  setWorkOrders: (orders: WorkOrder[]) => void;
  setThresholds: (thresholds: Thresholds) => void;
  setAlerts: (alerts: Alert[]) => void;
  setInspectionSuggestions: (suggestions: InspectionSuggestion[]) => void;
  setSelectedFloor: (floorId: string | null) => void;
  setSelectedSensor: (sensorId: string | null) => void;
  setSelectedZone: (zoneId: string | null) => void;
  setCurrentTime: (time: number) => void;
  setTimeRange: (range: TimeRange) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  setCameraRotation: (rotation: number) => void;
  setCameraElevation: (elevation: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getFloorSensors: (floorId: string) => Sensor[];
  getSensorWorkOrders: (sensorId: string) => WorkOrder[];
  getFloorWorkOrders: (floorId: string) => WorkOrder[];
  getSensorReadingAtTime: (sensorId: string, time: number) => { temperature: number; humidity: number; isOnline: boolean } | null;
  clearAll: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  floors: [],
  sensors: [],
  workOrders: [],
  thresholds: {
    temperatureMin: 18,
    temperatureMax: 26,
    humidityMin: 30,
    humidityMax: 70,
  },
  alerts: [],
  inspectionSuggestions: [],
  selectedFloorId: null,
  selectedSensorId: null,
  selectedZoneId: null,
  currentTime: Date.now(),
  timeRange: {
    start: Date.now() - 24 * 60 * 60 * 1000,
    end: Date.now(),
  },
  isPlaying: false,
  playSpeed: 1,
  cameraRotation: 0,
  cameraElevation: 30,
  isLoading: false,
  error: null,

  setFloors: (floors) => set({ floors }),
  setSensors: (sensors) => {
    if (sensors.length > 0) {
      const allTimestamps = sensors.flatMap((s) => s.readings.map((r) => r.timestamp));
      if (allTimestamps.length > 0) {
        const minTime = Math.min(...allTimestamps);
        const maxTime = Math.max(...allTimestamps);
        set({
          sensors,
          timeRange: { start: minTime, end: maxTime },
          currentTime: maxTime,
        });
        return;
      }
    }
    set({ sensors });
  },
  setWorkOrders: (orders) => set({ workOrders: orders }),
  setThresholds: (thresholds) => set({ thresholds }),
  setAlerts: (alerts) => set({ alerts }),
  setInspectionSuggestions: (suggestions) => set({ inspectionSuggestions: suggestions }),
  setSelectedFloor: (floorId) => set({ selectedFloorId: floorId }),
  setSelectedSensor: (sensorId) => set({ selectedSensorId: sensorId }),
  setSelectedZone: (zoneId) => set({ selectedZoneId: zoneId }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setTimeRange: (range) => set({ timeRange: range }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  setCameraRotation: (rotation) => set({ cameraRotation: rotation }),
  setCameraElevation: (elevation) => set({ cameraElevation: elevation }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  getFloorSensors: (floorId) => {
    return get().sensors.filter((s) => s.floorId === floorId);
  },

  getSensorWorkOrders: (sensorId) => {
    return get().workOrders.filter((o) => o.sensorId === sensorId);
  },

  getFloorWorkOrders: (floorId) => {
    return get().workOrders.filter((o) => o.floorId === floorId);
  },

  getSensorReadingAtTime: (sensorId, time) => {
    const sensor = get().sensors.find((s) => s.id === sensorId);
    if (!sensor || sensor.readings.length === 0) return null;

    const sortedReadings = [...sensor.readings].sort((a, b) => a.timestamp - b.timestamp);
    
    if (time < sortedReadings[0].timestamp) {
      return {
        temperature: sortedReadings[0].temperature,
        humidity: sortedReadings[0].humidity,
        isOnline: sortedReadings[0].isOnline,
      };
    }

    for (let i = 1; i < sortedReadings.length; i++) {
      if (time <= sortedReadings[i].timestamp) {
        const prev = sortedReadings[i - 1];
        const next = sortedReadings[i];
        const ratio = (time - prev.timestamp) / (next.timestamp - prev.timestamp);
        
        return {
          temperature: prev.temperature + (next.temperature - prev.temperature) * ratio,
          humidity: prev.humidity + (next.humidity - prev.humidity) * ratio,
          isOnline: prev.isOnline && next.isOnline,
        };
      }
    }

    const last = sortedReadings[sortedReadings.length - 1];
    return {
      temperature: last.temperature,
      humidity: last.humidity,
      isOnline: last.isOnline,
    };
  },

  clearAll: () => set({
    floors: [],
    sensors: [],
    workOrders: [],
    alerts: [],
    inspectionSuggestions: [],
    selectedFloorId: null,
    selectedSensorId: null,
    selectedZoneId: null,
    error: null,
  }),
}));
