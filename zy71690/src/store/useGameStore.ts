import { create } from 'zustand';
import type { GameState, GameStatus, Body, Marble, PhysicsParams, EnergyState, ErrorMark } from '@/types';
import { DEFAULT_BODIES, DEFAULT_MARBLE, DEFAULT_PHYSICS_PARAMS } from '@/types';

interface GameStore extends GameState {
  setStatus: (status: GameStatus) => void;
  setBodies: (bodies: Body[]) => void;
  setMarble: (marble: Marble) => void;
  setPhysicsParams: (params: PhysicsParams) => void;
  setLaunchAngle: (angle: number) => void;
  setLaunchSpeed: (speed: number) => void;
  addEnergyHistory: (energy: EnergyState) => void;
  incrementFrame: () => void;
  setSimulationTime: (time: number) => void;
  addErrorMark: (error: ErrorMark) => void;
  setErrorMarks: (errors: ErrorMark[]) => void;
  addTrajectoryPoint: (position: { x: number; y: number }, energy: EnergyState) => void;
  reset: () => void;
  resetToReady: () => void;
}

const initialState: GameState = {
  status: 'idle',
  bodies: JSON.parse(JSON.stringify(DEFAULT_BODIES)),
  marble: JSON.parse(JSON.stringify(DEFAULT_MARBLE)),
  physicsParams: { ...DEFAULT_PHYSICS_PARAMS },
  launchAngle: 0,
  launchSpeed: 80,
  energyHistory: [],
  currentFrame: 0,
  simulationTime: 0,
  errorMarks: [],
  trajectoryBuffer: {
    positions: [],
    energies: [],
    timestamps: [],
  },
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setBodies: (bodies) => set({ bodies }),
  setMarble: (marble) => set({ marble }),
  setPhysicsParams: (physicsParams) => set({ physicsParams }),
  setLaunchAngle: (launchAngle) => set({ launchAngle }),
  setLaunchSpeed: (launchSpeed) => set({ launchSpeed }),

  addEnergyHistory: (energy) => {
    const { energyHistory } = get();
    const newHistory = [...energyHistory, energy];
    if (newHistory.length > 300) newHistory.shift();
    set({ energyHistory: newHistory });
  },

  incrementFrame: () => {
    const { currentFrame } = get();
    set({ currentFrame: currentFrame + 1 });
  },

  setSimulationTime: (simulationTime) => set({ simulationTime }),

  addErrorMark: (error) => {
    const { errorMarks } = get();
    set({ errorMarks: [...errorMarks, error] });
  },

  setErrorMarks: (errorMarks) => set({ errorMarks }),

  addTrajectoryPoint: (position, energy) => {
    const { trajectoryBuffer, simulationTime } = get();
    set({
      trajectoryBuffer: {
        positions: [...trajectoryBuffer.positions, position],
        energies: [...trajectoryBuffer.energies, energy],
        timestamps: [...trajectoryBuffer.timestamps, simulationTime],
      },
    });
  },

  reset: () => {
    set({
      ...initialState,
      bodies: JSON.parse(JSON.stringify(DEFAULT_BODIES)),
      marble: JSON.parse(JSON.stringify(DEFAULT_MARBLE)),
      physicsParams: { ...DEFAULT_PHYSICS_PARAMS },
    });
  },

  resetToReady: () => {
    const { launchAngle, launchSpeed, physicsParams } = get();
    const marble = {
      ...JSON.parse(JSON.stringify(DEFAULT_MARBLE)),
      vx: Math.cos((launchAngle * Math.PI) / 180) * launchSpeed,
      vy: Math.sin((launchAngle * Math.PI) / 180) * launchSpeed,
    };

    set({
      status: 'ready',
      bodies: JSON.parse(JSON.stringify(DEFAULT_BODIES)),
      marble,
      physicsParams: { ...physicsParams },
      energyHistory: [],
      currentFrame: 0,
      simulationTime: 0,
      errorMarks: [],
      trajectoryBuffer: {
        positions: [],
        energies: [],
        timestamps: [],
      },
    });
  },
}));
