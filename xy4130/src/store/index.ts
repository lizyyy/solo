import { create } from 'zustand';
import type {
  StageProject,
  Risk,
  LightFixture,
  Rig,
  ProjectAdjustment,
  Scene,
} from '@/types';
import { evaluateRisksAtTime, getTotalDuration } from '@/risk';
import { generateUUID } from '@/utils/math';
import { defaultProject } from '@/data/defaultProject';

interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  playSpeed: number;
  totalDuration: number;
}

interface UIState {
  selectedLightId: string | null;
  selectedRigId: string | null;
  selectedActorId: string | null;
  showRisksPanel: boolean;
  showImportDialog: boolean;
  showExportDialog: boolean;
}

interface AppState {
  project: StageProject;
  timeline: TimelineState;
  ui: UIState;
  currentRisks: Risk[];
  adjustments: ProjectAdjustment[];
  scenes: Scene[];

  updateProject: (partial: Partial<StageProject>) => void;
  loadProject: (project: StageProject) => void;
  resetProject: () => void;

  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaySpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;

  selectLight: (id: string | null) => void;
  selectRig: (id: string | null) => void;
  selectActor: (id: string | null) => void;
  toggleRisksPanel: () => void;
  toggleImportDialog: () => void;
  toggleExportDialog: () => void;

  updateLightAngle: (lightId: string, pan: number, tilt: number, reason: string) => void;
  updateRigHeight: (rigId: string, height: number, reason: string) => void;
  updateLightIntensity: (lightId: string, intensity: number, reason: string) => void;

  addAdjustment: (adjustment: Omit<ProjectAdjustment, 'id' | 'timestamp'>) => void;
  evaluateCurrentRisks: () => void;
}

const createInitialTimeline = (project: StageProject): TimelineState => ({
  currentTime: 0,
  isPlaying: false,
  playSpeed: 1.0,
  totalDuration: getTotalDuration(project),
});

const initialUI: UIState = {
  selectedLightId: null,
  selectedRigId: null,
  selectedActorId: null,
  showRisksPanel: true,
  showImportDialog: false,
  showExportDialog: false,
};

export const useStore = create<AppState>((set, get) => ({
  project: defaultProject,
  timeline: createInitialTimeline(defaultProject),
  ui: initialUI,
  currentRisks: [],
  adjustments: [],
  scenes: defaultProject.scenes,

  updateProject: (partial) =>
    set((state) => {
      const newProject = { ...state.project, ...partial };
      return {
        project: newProject,
        timeline: createInitialTimeline(newProject),
        scenes: newProject.scenes,
      };
    }),

  loadProject: (project) =>
    set(() => ({
      project,
      timeline: createInitialTimeline(project),
      scenes: project.scenes,
      currentRisks: [],
      adjustments: [],
    })),

  resetProject: () =>
    set(() => ({
      project: defaultProject,
      timeline: createInitialTimeline(defaultProject),
      scenes: defaultProject.scenes,
      currentRisks: [],
      adjustments: [],
      ui: initialUI,
    })),

  setCurrentTime: (time) =>
    set((state) => {
      const clampedTime = Math.max(0, Math.min(state.timeline.totalDuration, time));
      const context = { project: state.project, time: clampedTime };
      const risks = evaluateRisksAtTime(context);
      return {
        timeline: { ...state.timeline, currentTime: clampedTime },
        currentRisks: risks,
      };
    }),

  togglePlay: () =>
    set((state) => ({
      timeline: { ...state.timeline, isPlaying: !state.timeline.isPlaying },
    })),

  setPlaySpeed: (speed) =>
    set((state) => ({
      timeline: { ...state.timeline, playSpeed: Math.max(0.1, Math.min(10, speed)) },
    })),

  stepForward: () => {
    const state = get();
    const newTime = Math.min(
      state.timeline.totalDuration,
      state.timeline.currentTime + state.timeline.playSpeed
    );
    get().setCurrentTime(newTime);
  },

  stepBackward: () => {
    const state = get();
    const newTime = Math.max(0, state.timeline.currentTime - state.timeline.playSpeed);
    get().setCurrentTime(newTime);
  },

  selectLight: (id) =>
    set((state) => ({
      ui: {
        ...state.ui,
        selectedLightId: id,
        selectedRigId: null,
        selectedActorId: null,
      },
    })),

  selectRig: (id) =>
    set((state) => ({
      ui: {
        ...state.ui,
        selectedLightId: null,
        selectedRigId: id,
        selectedActorId: null,
      },
    })),

  selectActor: (id) =>
    set((state) => ({
      ui: {
        ...state.ui,
        selectedLightId: null,
        selectedRigId: null,
        selectedActorId: id,
      },
    })),

  toggleRisksPanel: () =>
    set((state) => ({
      ui: { ...state.ui, showRisksPanel: !state.ui.showRisksPanel },
    })),

  toggleImportDialog: () =>
    set((state) => ({
      ui: { ...state.ui, showImportDialog: !state.ui.showImportDialog },
    })),

  toggleExportDialog: () =>
    set((state) => ({
      ui: { ...state.ui, showExportDialog: !state.ui.showExportDialog },
    })),

  updateLightAngle: (lightId, pan, tilt, reason) => {
    const state = get();
    const light = state.project.lights.find((l) => l.id === lightId);
    if (!light) return;

    const oldValue = { pan: light.pan, tilt: light.tilt };
    const newValue = { pan, tilt };

    set((s) => ({
      project: {
        ...s.project,
        lights: s.project.lights.map((l) =>
          l.id === lightId ? { ...l, pan, tilt } : l
        ),
      },
    }));

    get().addAdjustment({
      type: 'lightAngle',
      targetId: lightId,
      oldValue,
      newValue,
      reason,
    });

    get().evaluateCurrentRisks();
  },

  updateRigHeight: (rigId, height, reason) => {
    const state = get();
    const rig = state.project.rigs.find((r) => r.id === rigId);
    if (!rig) return;

    const oldValue = rig.currentHeight;

    set((s) => ({
      project: {
        ...s.project,
        rigs: s.project.rigs.map((r) =>
          r.id === rigId ? { ...r, currentHeight: height } : r
        ),
      },
    }));

    get().addAdjustment({
      type: 'rigHeight',
      targetId: rigId,
      oldValue,
      newValue: height,
      reason,
    });

    get().evaluateCurrentRisks();
  },

  updateLightIntensity: (lightId, intensity, reason) => {
    const state = get();
    const light = state.project.lights.find((l) => l.id === lightId);
    if (!light) return;

    const oldValue = light.intensity;

    set((s) => ({
      project: {
        ...s.project,
        lights: s.project.lights.map((l) =>
          l.id === lightId ? { ...l, intensity } : l
        ),
      },
    }));

    get().addAdjustment({
      type: 'intensity',
      targetId: lightId,
      oldValue,
      newValue: intensity,
      reason,
    });

    get().evaluateCurrentRisks();
  },

  addAdjustment: (adjustment) =>
    set((state) => ({
      adjustments: [
        ...state.adjustments,
        {
          ...adjustment,
          id: generateUUID(),
          timestamp: new Date(),
        },
      ],
    })),

  evaluateCurrentRisks: () => {
    const state = get();
    const context = { project: state.project, time: state.timeline.currentTime };
    const risks = evaluateRisksAtTime(context);
    set({ currentRisks: risks });
  },
}));
