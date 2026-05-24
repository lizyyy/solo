import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Sprinkler, Environment, FieldConfig, ViewMode, CoverageResult } from '../types';
import { defaultScenario } from '../utils/presets';
import { calculateCoverage } from '../utils/coverage';

interface AppState {
  sprinklers: Sprinkler[];
  environment: Environment;
  field: FieldConfig;
  coverageResult: CoverageResult | null;
  selectedSprinkler: string | null;
  viewMode: ViewMode;
  isPlaying: boolean;
  timeProgress: number;
  showHeatmap: boolean;
  showMissedZones: boolean;
  showSprinklerRanges: boolean;
  currentPresetId: string;

  setSprinklers: (sprinklers: Sprinkler[]) => void;
  updateSprinkler: (id: string, updates: Partial<Sprinkler>) => void;
  addSprinkler: (sprinkler: Sprinkler) => void;
  removeSprinkler: (id: string) => void;
  setEnvironment: (environment: Environment) => void;
  updateEnvironment: (updates: Partial<Environment>) => void;
  setField: (field: FieldConfig) => void;
  setCoverageResult: (result: CoverageResult | null) => void;
  calculateCoverage: () => void;
  setSelectedSprinkler: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setIsPlaying: (playing: boolean) => void;
  setTimeProgress: (progress: number | ((prev: number) => number)) => void;
  setShowHeatmap: (show: boolean) => void;
  setShowMissedZones: (show: boolean) => void;
  setShowSprinklerRanges: (show: boolean) => void;
  setCurrentPresetId: (id: string) => void;
  loadPreset: (preset: typeof defaultScenario) => void;
  resetState: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      sprinklers: [...defaultScenario.sprinklers],
      environment: { ...defaultScenario.environment },
      field: { ...defaultScenario.field },
      coverageResult: null,
      selectedSprinkler: null,
      viewMode: 'perspective',
      isPlaying: false,
      timeProgress: 1,
      showHeatmap: true,
      showMissedZones: true,
      showSprinklerRanges: true,
      currentPresetId: defaultScenario.id,

      setSprinklers: (sprinklers) => {
        set({ sprinklers });
        get().calculateCoverage();
      },

      updateSprinkler: (id, updates) => {
        set((state) => ({
          sprinklers: state.sprinklers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
        get().calculateCoverage();
      },

      addSprinkler: (sprinkler) => {
        set((state) => ({
          sprinklers: [...state.sprinklers, sprinkler],
        }));
        get().calculateCoverage();
      },

      removeSprinkler: (id) => {
        set((state) => ({
          sprinklers: state.sprinklers.filter((s) => s.id !== id),
          selectedSprinkler: state.selectedSprinkler === id ? null : state.selectedSprinkler,
        }));
        get().calculateCoverage();
      },

      setEnvironment: (environment) => {
        set({ environment });
        get().calculateCoverage();
      },

      updateEnvironment: (updates) => {
        set((state) => ({
          environment: { ...state.environment, ...updates },
        }));
        get().calculateCoverage();
      },

      setField: (field) => {
        set({ field });
        get().calculateCoverage();
      },

      setCoverageResult: (result) => set({ coverageResult: result }),

      calculateCoverage: () => {
        const { sprinklers, environment, field } = get();
        const result = calculateCoverage(sprinklers, environment, field);
        set({ coverageResult: result });
      },

      setSelectedSprinkler: (id) => set({ selectedSprinkler: id }),

      setViewMode: (mode) => set({ viewMode: mode }),

      setIsPlaying: (playing) => set({ isPlaying: playing }),

      setTimeProgress: (progress) =>
        set((state) => ({
          timeProgress: typeof progress === 'function' ? progress(state.timeProgress) : progress,
        })),

      setShowHeatmap: (show) => set({ showHeatmap: show }),

      setShowMissedZones: (show) => set({ showMissedZones: show }),

      setShowSprinklerRanges: (show) => set({ showSprinklerRanges: show }),

      setCurrentPresetId: (id) => set({ currentPresetId: id }),

      loadPreset: (preset) => {
        set({
          sprinklers: [...preset.sprinklers],
          environment: { ...preset.environment },
          field: { ...preset.field },
          currentPresetId: preset.id,
          selectedSprinkler: null,
        });
        get().calculateCoverage();
      },

      resetState: () => {
        set({
          sprinklers: [...defaultScenario.sprinklers],
          environment: { ...defaultScenario.environment },
          field: { ...defaultScenario.field },
          coverageResult: null,
          selectedSprinkler: null,
          viewMode: 'perspective',
          isPlaying: false,
          timeProgress: 1,
          showHeatmap: true,
          showMissedZones: true,
          showSprinklerRanges: true,
          currentPresetId: defaultScenario.id,
        });
        get().calculateCoverage();
      },
    }),
    {
      name: 'sprinkler-simulation-storage',
      partialize: (state) => ({
        sprinklers: state.sprinklers,
        environment: state.environment,
        field: state.field,
        viewMode: state.viewMode,
        showHeatmap: state.showHeatmap,
        showMissedZones: state.showMissedZones,
        showSprinklerRanges: state.showSprinklerRanges,
        currentPresetId: state.currentPresetId,
      }),
    }
  )
);
