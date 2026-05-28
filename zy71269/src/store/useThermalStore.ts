import { create } from 'zustand';
import { ChipPackage, FilterConditions, PowerPoint, TempSensor } from '../types';
import { mockChipPackage } from '../data/mockData';

interface ThermalState {
  chipPackage: ChipPackage;
  selectedItem: string | null;
  selectedItemType: 'powerPoint' | 'sensor' | null;
  filterConditions: FilterConditions;
  setSelectedItem: (id: string | null, type: 'powerPoint' | 'sensor' | null) => void;
  setFilter: (conditions: Partial<FilterConditions>) => void;
  getFilteredPowerPoints: () => PowerPoint[];
  getFilteredSensors: () => TempSensor[];
  getStatistics: () => {
    maxTemp: number;
    minTemp: number;
    avgTemp: number;
    hotspotCount: number;
  };
}

export const useThermalStore = create<ThermalState>((set, get) => ({
  chipPackage: mockChipPackage,
  selectedItem: null,
  selectedItemType: null,
  filterConditions: {
    tempRange: [50, 120],
    powerRange: [0, 100],
    showOnlyAnomalies: false
  },

  setSelectedItem: (id, type) => set({ selectedItem: id, selectedItemType: type }),

  setFilter: (conditions) => set((state) => ({
    filterConditions: { ...state.filterConditions, ...conditions }
  })),

  getFilteredPowerPoints: () => {
    const { chipPackage, filterConditions } = get();
    return chipPackage.powerPoints.filter(pp => {
      const tempInRange = pp.temperature >= filterConditions.tempRange[0] && 
                         pp.temperature <= filterConditions.tempRange[1];
      const powerInRange = pp.power >= filterConditions.powerRange[0] && 
                          pp.power <= filterConditions.powerRange[1];
      const isAnomaly = pp.status !== 'normal';
      const anomalyFilter = !filterConditions.showOnlyAnomalies || isAnomaly;
      return tempInRange && powerInRange && anomalyFilter;
    });
  },

  getFilteredSensors: () => {
    const { chipPackage, filterConditions } = get();
    return chipPackage.tempSensors.filter(s => {
      if (s.isMissing) return true;
      const tempInRange = s.temperature >= filterConditions.tempRange[0] && 
                         s.temperature <= filterConditions.tempRange[1];
      const anomalyFilter = !filterConditions.showOnlyAnomalies || s.isMissing;
      return tempInRange && anomalyFilter;
    });
  },

  getStatistics: () => {
    const { chipPackage } = get();
    const allTemps = [
      ...chipPackage.powerPoints.map(p => p.temperature),
      ...chipPackage.tempSensors.filter(s => !s.isMissing).map(s => s.temperature)
    ];
    const maxTemp = Math.max(...allTemps);
    const minTemp = Math.min(...allTemps);
    const avgTemp = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
    const hotspotCount = chipPackage.powerPoints.filter(p => p.status === 'critical').length;
    return { maxTemp, minTemp, avgTemp, hotspotCount };
  }
}));
