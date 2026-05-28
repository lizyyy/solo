import { create } from 'zustand';
import { FilterCriteria, PigmentStatus, AnomalyType } from '../types';

interface FilterStore {
  criteria: FilterCriteria;
  
  setTransparencyRange: (range: [number, number]) => void;
  setLightfastnessRange: (range: [number, number]) => void;
  setCostRange: (range: [number, number]) => void;
  setStatusFilter: (status: PigmentStatus[]) => void;
  setAnomaliesFilter: (anomalies: AnomalyType[]) => void;
  setSearchText: (text: string) => void;
  resetFilters: () => void;
  toggleStatus: (status: PigmentStatus) => void;
  toggleAnomaly: (anomaly: AnomalyType) => void;
}

const defaultCriteria: FilterCriteria = {
  transparencyRange: [0, 1],
  lightfastnessRange: [1, 8],
  costRange: [0, 1000],
  status: [],
  anomalies: [],
  searchText: '',
};

export const useFilterStore = create<FilterStore>((set, get) => ({
  criteria: defaultCriteria,

  setTransparencyRange: (range) => {
    set({ criteria: { ...get().criteria, transparencyRange: range } });
  },

  setLightfastnessRange: (range) => {
    set({ criteria: { ...get().criteria, lightfastnessRange: range } });
  },

  setCostRange: (range) => {
    set({ criteria: { ...get().criteria, costRange: range } });
  },

  setStatusFilter: (status) => {
    set({ criteria: { ...get().criteria, status } });
  },

  setAnomaliesFilter: (anomalies) => {
    set({ criteria: { ...get().criteria, anomalies } });
  },

  setSearchText: (text) => {
    set({ criteria: { ...get().criteria, searchText: text } });
  },

  resetFilters: () => {
    set({ criteria: defaultCriteria });
  },

  toggleStatus: (status) => {
    const current = get().criteria.status;
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    set({ criteria: { ...get().criteria, status: updated } });
  },

  toggleAnomaly: (anomaly) => {
    const current = get().criteria.anomalies;
    const updated = current.includes(anomaly)
      ? current.filter(a => a !== anomaly)
      : [...current, anomaly];
    set({ criteria: { ...get().criteria, anomalies: updated } });
  },
}));
