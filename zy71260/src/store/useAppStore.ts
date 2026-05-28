import { create } from 'zustand';
import type { AppStore, FilterState, ModeType, ChordFunction, ModulationType, DataQuality } from '../types';

const defaultFilters: FilterState = {
  modeTypes: ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
  chordFunctions: ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'leading'],
  modulationTypes: ['direct', 'pivot', 'sequential', 'enharmonic'],
  dataQualities: ['normal', 'borderline', 'error'],
  showBrokenPaths: true,
  showMismatchedAudio: true,
};

export const useAppStore = create<AppStore>((set) => ({
  modes: [],
  chords: [],
  modulationPaths: [],
  audioSamples: [],
  dataSources: [],
  selectedModeId: null,
  selectedChordId: null,
  highlightedPathId: null,
  filters: defaultFilters,
  isPlaying: false,
  currentAudioId: null,
  autoRotate: true,

  setSelectedMode: (id) => set({ selectedModeId: id, selectedChordId: null }),
  setSelectedChord: (id) => set({ selectedChordId: id, selectedModeId: null }),
  setHighlightedPath: (id) => set({ highlightedPathId: id }),
  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  toggleModeType: (type: ModeType) =>
    set((state) => ({
      filters: {
        ...state.filters,
        modeTypes: state.filters.modeTypes.includes(type)
          ? state.filters.modeTypes.filter((t) => t !== type)
          : [...state.filters.modeTypes, type],
      },
    })),

  toggleChordFunction: (func: ChordFunction) =>
    set((state) => ({
      filters: {
        ...state.filters,
        chordFunctions: state.filters.chordFunctions.includes(func)
          ? state.filters.chordFunctions.filter((f) => f !== func)
          : [...state.filters.chordFunctions, func],
      },
    })),

  toggleModulationType: (type: ModulationType) =>
    set((state) => ({
      filters: {
        ...state.filters,
        modulationTypes: state.filters.modulationTypes.includes(type)
          ? state.filters.modulationTypes.filter((t) => t !== type)
          : [...state.filters.modulationTypes, type],
      },
    })),

  toggleDataQuality: (quality: DataQuality) =>
    set((state) => ({
      filters: {
        ...state.filters,
        dataQualities: state.filters.dataQualities.includes(quality)
          ? state.filters.dataQualities.filter((q) => q !== quality)
          : [...state.filters.dataQualities, quality],
      },
    })),

  setShowBrokenPaths: (show) =>
    set((state) => ({
      filters: { ...state.filters, showBrokenPaths: show },
    })),

  setShowMismatchedAudio: (show) =>
    set((state) => ({
      filters: { ...state.filters, showMismatchedAudio: show },
    })),

  setPlaying: (playing, audioId = null) =>
    set({ isPlaying: playing, currentAudioId: audioId }),

  setAutoRotate: (auto) => set({ autoRotate: auto }),

  resetFilters: () => set({ filters: defaultFilters }),
}));

export const initializeStore = (data: {
  modes: AppStore['modes'];
  chords: AppStore['chords'];
  modulationPaths: AppStore['modulationPaths'];
  audioSamples: AppStore['audioSamples'];
  dataSources: AppStore['dataSources'];
}) => {
  useAppStore.setState({
    modes: data.modes,
    chords: data.chords,
    modulationPaths: data.modulationPaths,
    audioSamples: data.audioSamples,
    dataSources: data.dataSources,
  });
};

export const useFilteredModes = () => {
  const modes = useAppStore((state) => state.modes);
  const filters = useAppStore((state) => state.filters);
  return modes.filter(
    (mode) =>
      filters.modeTypes.includes(mode.type) &&
      filters.dataQualities.includes(mode.quality)
  );
};

export const useFilteredPaths = () => {
  const paths = useAppStore((state) => state.modulationPaths);
  const filters = useAppStore((state) => state.filters);
  return paths.filter(
    (path) =>
      filters.modulationTypes.includes(path.type) &&
      filters.dataQualities.includes(path.quality) &&
      (filters.showBrokenPaths || !path.isBroken)
  );
};

export const useSelectedMode = () => {
  const modes = useAppStore((state) => state.modes);
  const selectedId = useAppStore((state) => state.selectedModeId);
  return modes.find((m) => m.id === selectedId) || null;
};

export const useSelectedChord = () => {
  const chords = useAppStore((state) => state.chords);
  const selectedId = useAppStore((state) => state.selectedChordId);
  return chords.find((c) => c.id === selectedId) || null;
};

export const useDataSource = (sourceId: string) => {
  const dataSources = useAppStore((state) => state.dataSources);
  return dataSources.find((s) => s.id === sourceId) || null;
};

export const useAudioSample = (sampleId?: string) => {
  const audioSamples = useAppStore((state) => state.audioSamples);
  if (!sampleId) return null;
  return audioSamples.find((a) => a.id === sampleId) || null;
};
