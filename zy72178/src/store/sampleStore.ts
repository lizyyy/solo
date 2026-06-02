import { create } from 'zustand';
import { getAllFromStore, getFromStore } from '../db';
import { importSamples as importSamplesService, parseJSONLFile } from '../services/checkupEngine';
import type { Sample, ImportSampleInput } from '../types';

interface SampleState {
  samples: Sample[];
  selectedSampleIds: string[];
  loading: boolean;
  error: string | null;
  fetchSamples: () => Promise<void>;
  importSamples: (file: File) => Promise<Sample[]>;
  importFromData: (data: ImportSampleInput[], filename: string) => Promise<Sample[]>;
  getSample: (id: string) => Sample | undefined;
  toggleSampleSelection: (id: string) => void;
  selectAllSamples: () => void;
  clearSelection: () => void;
  setSelectedSamples: (ids: string[]) => void;
}

export const useSampleStore = create<SampleState>((set, get) => ({
  samples: [],
  selectedSampleIds: [],
  loading: false,
  error: null,
  fetchSamples: async () => {
    set({ loading: true, error: null });
    try {
      const samples = await getAllFromStore('samples', 'by-importedAt', 'prev');
      set({ samples, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  importSamples: async (file) => {
    set({ loading: true, error: null });
    try {
      const data = await parseJSONLFile(file);
      const samples = await importSamplesService(data, file.name);
      await get().fetchSamples();
      return samples;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  importFromData: async (data, filename) => {
    set({ loading: true, error: null });
    try {
      const samples = await importSamplesService(data, filename);
      await get().fetchSamples();
      return samples;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },
  getSample: (id) => get().samples.find(s => s.id === id),
  toggleSampleSelection: (id) => set((state) => ({
    selectedSampleIds: state.selectedSampleIds.includes(id)
      ? state.selectedSampleIds.filter(sid => sid !== id)
      : [...state.selectedSampleIds, id],
  })),
  selectAllSamples: () => set((state) => ({
    selectedSampleIds: state.samples.map(s => s.id),
  })),
  clearSelection: () => set({ selectedSampleIds: [] }),
  setSelectedSamples: (ids) => set({ selectedSampleIds: ids }),
}));
