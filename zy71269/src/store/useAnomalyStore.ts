import { create } from 'zustand';
import { Anomaly } from '../types';
import { detectAnomalies } from '../utils/anomalyDetection';
import { useThermalStore } from './useThermalStore';
import { useView3DStore } from './useView3DStore';

interface AnomalyState {
  anomalies: Anomaly[];
  isDetecting: boolean;
  dismissedAnomalies: string[];
  runDetection: () => void;
  dismissAnomaly: (id: string) => void;
  locateAnomaly: (id: string) => void;
}

export const useAnomalyStore = create<AnomalyState>((set, get) => ({
  anomalies: [],
  isDetecting: false,
  dismissedAnomalies: [],

  runDetection: () => {
    set({ isDetecting: true });
    const chipPackage = useThermalStore.getState().chipPackage;
    const colorScale = useView3DStore.getState().colorScale;
    const { dismissedAnomalies } = get();
    
    const detected = detectAnomalies(chipPackage, colorScale);
    const filtered = detected.filter(a => !dismissedAnomalies.includes(a.id));
    
    set({ anomalies: filtered, isDetecting: false });
  },

  dismissAnomaly: (id: string) => {
    set((state) => ({
      dismissedAnomalies: [...state.dismissedAnomalies, id],
      anomalies: state.anomalies.filter(a => a.id !== id)
    }));
  },

  locateAnomaly: (id: string) => {
    const { anomalies } = get();
    const anomaly = anomalies.find(a => a.id === id);
    
    if (anomaly?.location) {
      useView3DStore.getState().focusItem(anomaly.location);
      useThermalStore.getState().setSelectedItem(
        anomaly.relatedItemId || null,
        anomaly.type === 'missing_sensor' ? 'sensor' : null
      );
    } else if (anomaly?.relatedItemId) {
      const chipPackage = useThermalStore.getState().chipPackage;
      const sensor = chipPackage.tempSensors.find(s => s.id === anomaly.relatedItemId);
      if (sensor) {
        useView3DStore.getState().focusItem(sensor.position);
        useThermalStore.getState().setSelectedItem(sensor.id, 'sensor');
      }
    }
  }
}));
