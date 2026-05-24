import { create } from 'zustand';
import { SimulationEngine } from '../simulation/engine';
import {
  StationScene,
  Passenger,
  Bottleneck,
  Statistics,
  SimulationState
} from '../simulation/types';

interface SimulationStore extends SimulationState {
  engine: SimulationEngine | null;
  setScene: (scene: StationScene) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setCurrentTime: (time: number) => void;
  toggle2DMode: () => void;
  setCameraView: (view: 'default' | 'top' | 'angle' | 'firstPerson') => void;
  reset: () => void;
  updateSimulation: (deltaTime: number) => void;
  closeExit: (exitId: string) => void;
  openExit: (exitId: string) => void;
  addClosedArea: (x: number, y: number, width: number, height: number, reason: string) => void;
  removeClosedArea: (areaId: string) => void;
}

const initialStatistics: Statistics = {
  totalPassengers: 0,
  exitedCount: 0,
  waitingCount: 0,
  stuckCount: 0,
  avgEvacuationTime: 0,
  maxWaitTime: 0,
  bottleneckRanking: [],
  timeSeriesData: [],
  completionRate: 0
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  speed: 1,
  passengers: [],
  bottlenecks: [],
  statistics: initialStatistics,
  selectedScene: null,
  is2DMode: false,
  cameraView: 'default',
  engine: null,

  setScene: (scene: StationScene) => {
    const engine = new SimulationEngine(scene);
    set({
      selectedScene: scene,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  },

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),

  setSpeed: (speed: number) => set({ speed }),

  setCurrentTime: (time: number) => {
    const { engine, selectedScene } = get();
    if (!engine || !selectedScene) return;
    
    engine.reset();
    const targetTime = time;
    const stepSize = 0.1;
    
    while (engine.getCurrentTime() < targetTime) {
      const remaining = targetTime - engine.getCurrentTime();
      const step = Math.min(stepSize, remaining);
      engine.step(step);
    }
    
    set({
      currentTime: engine.getCurrentTime(),
      passengers: [...engine.getPassengers()],
      bottlenecks: [...engine.getBottlenecks()],
      statistics: engine.getStatistics()
    });
  },

  toggle2DMode: () => set(state => ({ is2DMode: !state.is2DMode })),

  setCameraView: (view) => set({ cameraView: view }),

  reset: () => {
    const { engine } = get();
    if (engine) {
      engine.reset();
      set({
        isPlaying: false,
        currentTime: 0,
        passengers: [],
        bottlenecks: [],
        statistics: initialStatistics
      });
    }
  },

  updateSimulation: (deltaTime: number) => {
    const { engine, speed, isPlaying } = get();
    if (!engine || !isPlaying) return;

    engine.step(deltaTime * speed);
    
    set({
      currentTime: engine.getCurrentTime(),
      passengers: [...engine.getPassengers()],
      bottlenecks: [...engine.getBottlenecks()],
      statistics: engine.getStatistics()
    });

    if (engine.isComplete()) {
      set({ isPlaying: false });
    }
  },

  closeExit: (exitId: string) => {
    const { selectedScene } = get();
    if (!selectedScene) return;
    
    const updatedScene = {
      ...selectedScene,
      layout: {
        ...selectedScene.layout,
        gates: selectedScene.layout.gates.map(gate =>
          gate.id === exitId ? { ...gate, status: 'closed' as const } : gate
        )
      }
    };
    
    const engine = new SimulationEngine(updatedScene);
    set({
      selectedScene: updatedScene,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  },

  openExit: (exitId: string) => {
    const { selectedScene } = get();
    if (!selectedScene) return;
    
    const updatedScene = {
      ...selectedScene,
      layout: {
        ...selectedScene.layout,
        gates: selectedScene.layout.gates.map(gate =>
          gate.id === exitId ? { ...gate, status: 'open' as const } : gate
        )
      }
    };
    
    const engine = new SimulationEngine(updatedScene);
    set({
      selectedScene: updatedScene,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  },

  addClosedArea: (x: number, y: number, width: number, height: number, reason: string) => {
    const { selectedScene } = get();
    if (!selectedScene) return;
    
    const newArea = {
      id: `closed-area-${Date.now()}`,
      x, y, width, height, reason
    };
    
    const updatedScene = {
      ...selectedScene,
      closedAreas: [...selectedScene.closedAreas, newArea]
    };
    
    const engine = new SimulationEngine(updatedScene);
    set({
      selectedScene: updatedScene,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  },

  removeClosedArea: (areaId: string) => {
    const { selectedScene } = get();
    if (!selectedScene) return;
    
    const updatedScene = {
      ...selectedScene,
      closedAreas: selectedScene.closedAreas.filter(a => a.id !== areaId)
    };
    
    const engine = new SimulationEngine(updatedScene);
    set({
      selectedScene: updatedScene,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  }
}));
