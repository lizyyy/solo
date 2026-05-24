import { create } from 'zustand';
import {
  VehicleParams,
  SceneData,
  SimulationState,
  PathPoint,
  CollisionPoint,
  SweepArea,
  CameraView,
  Sample,
} from '../types';
import { samples, vehiclePresets } from '../data/samples';

interface SimulationStore {
  vehicle: VehicleParams;
  scene: SceneData;
  simulation: SimulationState;
  currentSample: Sample | null;
  samples: Sample[];
  vehiclePresets: VehicleParams[];
  
  setVehicle: (vehicle: VehicleParams) => void;
  updateVehicleParam: (key: keyof VehicleParams, value: number) => void;
  setScene: (scene: SceneData) => void;
  setCurrentSample: (sample: Sample) => void;
  setSimulationStatus: (status: SimulationState['status']) => void;
  setProgress: (progress: number | ((prev: number) => number)) => void;
  setPath: (path: PathPoint[]) => void;
  setCollisionPoints: (points: CollisionPoint[]) => void;
  setSweepAreas: (areas: SweepArea[]) => void;
  setCameraView: (view: CameraView) => void;
  setSpeed: (speed: number) => void;
  resetSimulation: () => void;
  loadSampleById: (id: string) => void;
  resetToDefault: () => void;
}

const defaultSample = samples[0];

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  vehicle: defaultSample.vehicle,
  scene: defaultSample.scene,
  simulation: {
    status: 'idle',
    progress: 0,
    currentPath: [],
    collisionPoints: [],
    isCollision: false,
    cameraView: 'free',
    speed: 1,
    sweepAreas: [],
  },
  currentSample: defaultSample,
  samples,
  vehiclePresets,

  setVehicle: (vehicle) => set({ vehicle }),
  updateVehicleParam: (key, value) =>
    set((state) => ({
      vehicle: { ...state.vehicle, [key]: value },
    })),
  setScene: (scene) => set({ scene }),
  setCurrentSample: (sample) =>
    set({
      currentSample: sample,
      vehicle: sample.vehicle,
      scene: sample.scene,
      simulation: {
        ...get().simulation,
        status: 'idle',
        progress: 0,
        currentPath: [],
        collisionPoints: [],
        isCollision: false,
        sweepAreas: [],
      },
    }),
  setSimulationStatus: (status) =>
    set((state) => ({
      simulation: { ...state.simulation, status },
    })),
  setProgress: (progress: number | ((prev: number) => number)) =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        progress: typeof progress === 'function' ? progress(state.simulation.progress) : progress,
      },
    })),
  setPath: (currentPath) =>
    set((state) => ({
      simulation: { ...state.simulation, currentPath },
    })),
  setCollisionPoints: (collisionPoints) =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        collisionPoints,
        isCollision: collisionPoints.length > 0,
      },
    })),
  setSweepAreas: (sweepAreas) =>
    set((state) => ({
      simulation: { ...state.simulation, sweepAreas },
    })),
  setCameraView: (cameraView) =>
    set((state) => ({
      simulation: { ...state.simulation, cameraView },
    })),
  setSpeed: (speed) =>
    set((state) => ({
      simulation: { ...state.simulation, speed },
    })),
  resetSimulation: () =>
    set((state) => ({
      simulation: {
        ...state.simulation,
        status: 'idle',
        progress: 0,
        currentPath: [],
        collisionPoints: [],
        isCollision: false,
        sweepAreas: [],
      },
    })),
  loadSampleById: (id) => {
    const sample = samples.find((s) => s.id === id);
    if (sample) {
      get().setCurrentSample(sample);
    }
  },
  resetToDefault: () => {
    get().setCurrentSample(defaultSample);
  },
}));
