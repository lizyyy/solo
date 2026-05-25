import { create } from 'zustand';
import {
  SimulationState,
  SmokeParticle,
  CameraView,
  Scene,
  SimulationError,
  FanOperation,
  TimeStep
} from '../types';
import { sampleScenes } from '../data/sampleScenes';

interface SimulationActions {
  togglePlay: () => void;
  setCurrentStep: (step: number) => void;
  setSpeed: (speed: number) => void;
  toggleFan: (fanId: string) => void;
  setFanDirection: (fanId: string, direction: 'forward' | 'backward') => void;
  setFanPower: (fanId: string, power: number) => void;
  setCameraView: (view: CameraView) => void;
  selectScene: (scene: Scene) => void;
  resetSimulation: () => void;
  addSmokeParticle: (particle: SmokeParticle) => void;
  updateSmokeParticles: (particles: SmokeParticle[]) => void;
  addError: (error: Omit<SimulationError, 'id'>) => void;
  addOperation: (operation: Omit<FanOperation, 'id'>) => void;
  addTimeStep: (timeStep: TimeStep) => void;
  setSmokeCoverage: (coverage: number) => void;
  updateEscapeRoute: (id: string, isBlocked: boolean) => void;
  incrementStep: () => void;
}

const initialState: SimulationState = {
  isPlaying: false,
  currentStep: 0,
  maxSteps: 300,
  speed: 1,
  fans: [],
  smokeParticles: [],
  escapeRoutes: [],
  smokeSources: [],
  vehicles: [],
  errors: [],
  operations: [],
  timeSteps: [],
  cameraView: 'overview',
  selectedScene: null,
  startTime: 0,
  smokeCoverage: 0
};

export const useSimulationStore = create<SimulationState & SimulationActions>((set) => ({
  ...initialState,

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setCurrentStep: (step: number) => set({ currentStep: step }),

  setSpeed: (speed: number) => set({ speed }),

  toggleFan: (fanId: string) => set((state) => {
    const fans = state.fans.map((fan) =>
      fan.id === fanId ? { ...fan, isOn: !fan.isOn } : fan
    );
    const fan = state.fans.find((f) => f.id === fanId);
    if (fan) {
      state.addOperation({
        fanId,
        action: 'toggle',
        value: !fan.isOn,
        timestamp: Date.now(),
        step: state.currentStep
      });
    }
    return { fans };
  }),

  setFanDirection: (fanId: string, direction: 'forward' | 'backward') => set((state) => {
    const fans = state.fans.map((fan) =>
      fan.id === fanId ? { ...fan, direction } : fan
    );
    state.addOperation({
      fanId,
      action: 'direction',
      value: direction,
      timestamp: Date.now(),
      step: state.currentStep
    });
    return { fans };
  }),

  setFanPower: (fanId: string, power: number) => set((state) => ({
    fans: state.fans.map((fan) =>
      fan.id === fanId ? { ...fan, power: Math.max(0, Math.min(100, power)) } : fan
    )
  })),

  setCameraView: (view: CameraView) => set({ cameraView: view }),

  selectScene: (scene: Scene) => set({
    selectedScene: scene,
    fans: JSON.parse(JSON.stringify(scene.fans)),
    escapeRoutes: JSON.parse(JSON.stringify(scene.escapeRoutes)),
    smokeSources: JSON.parse(JSON.stringify(scene.smokeSources)),
    vehicles: JSON.parse(JSON.stringify(scene.vehicles)),
    smokeParticles: [],
    errors: [],
    operations: [],
    timeSteps: [],
    currentStep: 0,
    isPlaying: false,
    startTime: Date.now(),
    smokeCoverage: 0
  }),

  resetSimulation: () => set((state) => {
    if (!state.selectedScene) return initialState;
    return {
      ...initialState,
      selectedScene: state.selectedScene,
      fans: JSON.parse(JSON.stringify(state.selectedScene.fans)),
      escapeRoutes: JSON.parse(JSON.stringify(state.selectedScene.escapeRoutes)),
      smokeSources: JSON.parse(JSON.stringify(state.selectedScene.smokeSources)),
      vehicles: JSON.parse(JSON.stringify(state.selectedScene.vehicles)),
      startTime: Date.now()
    };
  }),

  addSmokeParticle: (particle: SmokeParticle) => set((state) => ({
    smokeParticles: [...state.smokeParticles, particle]
  })),

  updateSmokeParticles: (particles: SmokeParticle[]) => set({ smokeParticles: particles }),

  addError: (error: Omit<SimulationError, 'id'>) => set((state) => ({
    errors: [...state.errors, { ...error, id: `error-${Date.now()}-${Math.random()}` }]
  })),

  addOperation: (operation: Omit<FanOperation, 'id'>) => set((state) => ({
    operations: [...state.operations, { ...operation, id: `op-${Date.now()}-${Math.random()}` }]
  })),

  addTimeStep: (timeStep: TimeStep) => set((state) => ({
    timeSteps: [...state.timeSteps, timeStep]
  })),

  setSmokeCoverage: (coverage: number) => set({ smokeCoverage: coverage }),

  updateEscapeRoute: (id: string, isBlocked: boolean) => set((state) => ({
    escapeRoutes: state.escapeRoutes.map((route) =>
      route.id === id ? { ...route, isBlocked } : route
    )
  })),

  incrementStep: () => set((state) => {
    const newStep = Math.min(state.currentStep + 1, state.maxSteps);
    return { currentStep: newStep };
  })
}));

export const initializeDefaultScene = () => {
  const store = useSimulationStore.getState();
  if (!store.selectedScene && sampleScenes.length > 0) {
    store.selectScene(sampleScenes[0]);
  }
};
