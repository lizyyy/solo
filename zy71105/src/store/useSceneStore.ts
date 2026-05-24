import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Light, ForbiddenZone, ProgramSegment, CollisionWarning, SceneData } from '../types';
import { sampleLights, sampleForbiddenZones, sampleProgramSegments } from '../services/sampleData';
import { checkAllCollisions } from '../services/collision';

interface SceneState {
  lights: Light[];
  forbiddenZones: ForbiddenZone[];
  selectedLightId: string | null;
  filters: {
    group: string;
    search: string;
  };
  collisionWarnings: CollisionWarning[];
  currentTime: number;
  isPlaying: boolean;
  programSegments: ProgramSegment[];
  currentSegmentId: string | null;
  cameraView: 'front' | 'top' | 'side' | 'free';
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
}

interface SceneActions {
  setSelectedLight: (id: string | null) => void;
  updateLight: (id: string, updates: Partial<Light>) => void;
  addLight: (light: Light) => void;
  removeLight: (id: string) => void;
  setFilters: (filters: Partial<{ group: string; search: string }>) => void;
  checkCollisions: () => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setCameraView: (view: 'front' | 'top' | 'side' | 'free') => void;
  loadSampleData: () => void;
  resetScene: () => void;
  exportScene: () => SceneData;
  importScene: (data: SceneData) => void;
  setCurrentSegment: (segmentId: string | null) => void;
  applySegmentState: (segmentId: string) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

const initialState: SceneState = {
  lights: [],
  forbiddenZones: [],
  selectedLightId: null,
  filters: {
    group: '',
    search: ''
  },
  collisionWarnings: [],
  currentTime: 0,
  isPlaying: false,
  programSegments: [],
  currentSegmentId: null,
  cameraView: 'free',
  leftPanelOpen: true,
  rightPanelOpen: true
};

export const useSceneStore = create<SceneState & SceneActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setSelectedLight: (id) => set({ selectedLightId: id }),
      
      updateLight: (id, updates) => {
        set((state) => ({
          lights: state.lights.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          )
        }));
        get().checkCollisions();
      },
      
      addLight: (light) => {
        set((state) => ({
          lights: [...state.lights, light]
        }));
        get().checkCollisions();
      },
      
      removeLight: (id) => {
        set((state) => ({
          lights: state.lights.filter((l) => l.id !== id),
          selectedLightId: state.selectedLightId === id ? null : state.selectedLightId
        }));
        get().checkCollisions();
      },
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      
      checkCollisions: () => {
        const { lights, forbiddenZones, currentTime } = get();
        const warnings = checkAllCollisions(lights, forbiddenZones, currentTime);
        set({ collisionWarnings: warnings });
      },
      
      setCurrentTime: (time) => {
        const { programSegments, currentSegmentId } = get();
        const segment = programSegments.find(
          (s) => time >= s.startTime && time < s.endTime
        );
        
        const newSegmentId = segment?.id || null;
        const segmentChanged = newSegmentId !== currentSegmentId;
        
        set({
          currentTime: time,
          currentSegmentId: newSegmentId
        });
        
        if (segmentChanged && newSegmentId) {
          get().applySegmentState(newSegmentId as string);
        } else {
          get().checkCollisions();
        }
      },
      
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      
      setCameraView: (view) => set({ cameraView: view }),
      
      loadSampleData: () => {
        set({
          lights: sampleLights,
          forbiddenZones: sampleForbiddenZones,
          programSegments: sampleProgramSegments,
          currentSegmentId: sampleProgramSegments[0]?.id || null
        });
        get().checkCollisions();
      },
      
      resetScene: () => {
        set({
          ...initialState,
          lights: sampleLights,
          forbiddenZones: sampleForbiddenZones,
          programSegments: sampleProgramSegments,
          currentSegmentId: sampleProgramSegments[0]?.id || null
        });
        get().checkCollisions();
      },
      
      exportScene: (): SceneData => {
        const { lights, forbiddenZones, programSegments, filters } = get();
        return {
          lights,
          forbiddenZones,
          programSegments,
          filters,
          version: '1.0.0',
          exportedAt: new Date().toISOString()
        };
      },
      
      importScene: (data: SceneData) => {
        set({
          lights: data.lights,
          forbiddenZones: data.forbiddenZones,
          programSegments: data.programSegments,
          filters: data.filters,
          currentSegmentId: data.programSegments[0]?.id || null
        });
        get().checkCollisions();
      },
      
      setCurrentSegment: (segmentId) => {
        const { programSegments } = get();
        const segment = programSegments.find((s) => s.id === segmentId);
        if (segment && segmentId) {
          set({
            currentSegmentId: segmentId,
            currentTime: segment.startTime
          });
          get().applySegmentState(segmentId as string);
        }
      },
      
      applySegmentState: (segmentId) => {
        const { programSegments } = get();
        const segment = programSegments.find((s) => s.id === segmentId);
        if (!segment) return;
        
        set((state) => ({
          lights: state.lights.map((light) => {
            const lightState = segment.lightStates.find(
              (ls) => ls.lightId === light.id
            );
            if (lightState) {
              return {
                ...light,
                position: lightState.position,
                target: lightState.target,
                intensity: lightState.intensity,
                enabled: true
              };
            }
            return { ...light, enabled: false };
          })
        }));
        get().checkCollisions();
      },
      
      toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen }))
    }),
    {
      name: 'stage-lighting-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lights: state.lights,
        forbiddenZones: state.forbiddenZones,
        filters: state.filters,
        cameraView: state.cameraView,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
        programSegments: state.programSegments
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.checkCollisions();
        }
      }
    }
  )
);

export const getFilteredLights = (lights: Light[], filters: { group: string; search: string }) => {
  return lights.filter((light) => {
    const matchesGroup = !filters.group || light.group === filters.group;
    const matchesSearch = !filters.search ||
      light.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      light.type.toLowerCase().includes(filters.search.toLowerCase());
    return matchesGroup && matchesSearch;
  });
};

export const getLightGroups = (lights: Light[]) => {
  const groups = new Set(lights.map((l) => l.group));
  return Array.from(groups);
};
