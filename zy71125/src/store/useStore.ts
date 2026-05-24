import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Container, Yard, Task, CameraView, AppState } from '../types';
import { analyzeAccessibility } from '../utils/accessibility';
import { importScenarioData, generateSampleContainers, sampleYard } from '../data/sampleData';

interface StoreState extends AppState {
  setContainers: (containers: Container[]) => void;
  setYard: (yard: Yard | null) => void;
  selectContainer: (id: string | null) => void;
  setFilter: (filter: { bay: number | null; search: string }) => void;
  setCameraView: (view: CameraView) => void;
  loadScenario: (scenarioId: string) => void;
  resetState: () => void;
  analyzeTargetContainer: (containerId: string) => void;
  clearTask: () => void;
  setTimelineStep: (step: number) => void;
  setTimelinePlaying: (isPlaying: boolean) => void;
  setTimelineSpeed: (speed: number) => void;
  importCustomData: (yard: Yard, containers: Container[]) => void;
}

const STORAGE_KEY = 'yard-accessibility-state';

const initialState: Omit<AppState, 'containers' | 'yard'> = {
  selectedContainerId: null,
  currentTask: null,
  filter: {
    bay: null,
    search: '',
  },
  timeline: {
    currentStep: 0,
    isPlaying: false,
    speed: 1,
  },
  cameraView: 'default',
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      containers: generateSampleContainers(),
      yard: sampleYard,
      ...initialState,

      setContainers: (containers) => set({ containers }),

      setYard: (yard) => set({ yard }),

      selectContainer: (id) => set({ selectedContainerId: id }),

      setFilter: (filter) => set({ filter }),

      setCameraView: (cameraView) => set({ cameraView }),

      loadScenario: (scenarioId) => {
        const { yard, containers, targetId } = importScenarioData(scenarioId);
        set({
          yard,
          containers,
          selectedContainerId: targetId,
          currentTask: null,
          timeline: { currentStep: 0, isPlaying: false, speed: 1 },
        });
        if (targetId) {
          setTimeout(() => {
            get().analyzeTargetContainer(targetId);
          }, 100);
        }
      },

      resetState: () => {
        set({
          containers: generateSampleContainers(),
          yard: sampleYard,
          ...initialState,
        });
      },

      analyzeTargetContainer: (containerId) => {
        const { containers, yard } = get();
        if (!yard) return;

        const targetContainer = containers.find((c) => c.id === containerId);
        if (!targetContainer) return;

        const result = analyzeAccessibility(targetContainer, containers, yard);

        const task: Task = {
          id: `task-${Date.now()}`,
          targetContainerId: containerId,
          moves: result.moves,
          totalRelocations: result.minRelocations,
          optimalSide: result.optimalSide,
          createdAt: Date.now(),
        };

        const updatedContainers = containers.map((c) => {
          if (c.id === containerId) {
            return { ...c, status: 'target' as const };
          }
          if (result.blockingContainers.some((b) => b.id === c.id)) {
            return { ...c, status: 'blocking' as const };
          }
          return { ...c, status: 'normal' as const };
        });

        set({
          containers: updatedContainers,
          currentTask: task,
          selectedContainerId: containerId,
          timeline: { currentStep: 0, isPlaying: false, speed: 1 },
        });
      },

      clearTask: () => {
        const { containers } = get();
        const resetContainers = containers.map((c) => ({
          ...c,
          status: 'normal' as const,
        }));
        set({
          containers: resetContainers,
          currentTask: null,
          timeline: { currentStep: 0, isPlaying: false, speed: 1 },
        });
      },

      setTimelineStep: (currentStep) =>
        set((state) => ({
          timeline: { ...state.timeline, currentStep },
        })),

      setTimelinePlaying: (isPlaying) =>
        set((state) => ({
          timeline: { ...state.timeline, isPlaying },
        })),

      setTimelineSpeed: (speed) =>
        set((state) => ({
          timeline: { ...state.timeline, speed },
        })),

      importCustomData: (yard, containers) => {
        set({
          yard,
          containers,
          selectedContainerId: null,
          currentTask: null,
          timeline: { currentStep: 0, isPlaying: false, speed: 1 },
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filter: state.filter,
        cameraView: state.cameraView,
      }),
    }
  )
);
