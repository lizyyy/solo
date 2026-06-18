import { create } from 'zustand';
import type { Material, Anomaly, Station, FilterState } from '@/types';
import { stations as mockStations } from '@/data/stations';
import { materials as mockMaterials } from '@/data/materials';
import { detectAllAnomalies } from '@/utils/anomalyDetector';

interface AppState {
  materials: Material[];
  stations: Station[];
  anomalies: Anomaly[];
  selectedStationId: string | null;
  selectedAnomalyId: string | null;
  filter: FilterState;
  sidebarCollapsed: boolean;

  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, data: Partial<Material>) => void;
  detectAnomalies: () => void;
  setAnomalyStatus: (id: string, status: 'confirmed' | 'pending') => void;
  selectStation: (id: string | null) => void;
  selectAnomaly: (id: string | null) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  toggleSidebar: () => void;
  getFilteredAnomalies: () => Anomaly[];
  getStationAnomalies: (stationId: string) => Anomaly[];
}

export const useAppStore = create<AppState>((set, get) => ({
  materials: mockMaterials,
  stations: mockStations,
  anomalies: detectAllAnomalies(mockMaterials),
  selectedStationId: null,
  selectedAnomalyId: null,
  filter: {
    type: 'all',
    status: 'all',
    severity: 'all',
    stationId: 'all',
  },
  sidebarCollapsed: false,

  addMaterial: (material) => {
    set((state) => {
      const newMaterials = [...state.materials, material];
      const newAnomalies = detectAllAnomalies(newMaterials);
      return { materials: newMaterials, anomalies: newAnomalies };
    });
  },

  updateMaterial: (id, data) => {
    set((state) => {
      const newMaterials = state.materials.map(m =>
        m.id === id ? { ...m, ...data } : m
      );
      const newAnomalies = detectAllAnomalies(newMaterials);
      return { materials: newMaterials, anomalies: newAnomalies };
    });
  },

  detectAnomalies: () => {
    set((state) => ({
      anomalies: detectAllAnomalies(state.materials),
    }));
  },

  setAnomalyStatus: (id, status) => {
    set((state) => ({
      anomalies: state.anomalies.map(a =>
        a.id === id ? { ...a, status } : a
      ),
    }));
  },

  selectStation: (id) => {
    set({ selectedStationId: id });
  },

  selectAnomaly: (id) => {
    set({ selectedAnomalyId: id });
  },

  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  getFilteredAnomalies: () => {
    const { anomalies, filter } = get();
    return anomalies.filter(a => {
      if (filter.type !== 'all' && a.type !== filter.type) return false;
      if (filter.status !== 'all' && a.status !== filter.status) return false;
      if (filter.severity !== 'all' && a.severity !== filter.severity) return false;
      if (filter.stationId !== 'all' && a.stationId !== filter.stationId) return false;
      return true;
    });
  },

  getStationAnomalies: (stationId) => {
    const { anomalies } = get();
    return anomalies.filter(a => a.stationId === stationId);
  },
}));
