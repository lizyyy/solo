import { create } from 'zustand';
import { SimulationEngine } from '../simulation/engine';
import {
  StationScene,
  PassengerBatch,
  Statistics,
  SimulationState
} from '../simulation/types';

interface StrategyResult {
  id: string;
  name: string;
  scene: StationScene;
  statistics: Statistics;
}

interface SimulationStore extends SimulationState {
  engine: SimulationEngine | null;
  passengerBatches: PassengerBatch[];
  strategyResults: StrategyResult[];
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
  updatePassengerBatch: (batchId: string, updates: Partial<PassengerBatch>) => void;
  addPassengerBatch: () => void;
  removePassengerBatch: (batchId: string) => void;
  saveStrategyResult: (name: string) => void;
  removeStrategyResult: (id: string) => void;
  clearStrategyResults: () => void;
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
  passengerBatches: [],
  strategyResults: [],

  setScene: (scene: StationScene) => {
    const engine = new SimulationEngine(scene);
    set({
      selectedScene: scene,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false,
      passengerBatches: [...scene.passengerBatches]
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
  },

  updatePassengerBatch: (batchId: string, updates: Partial<PassengerBatch>) => {
    const { selectedScene, passengerBatches } = get();
    if (!selectedScene) return;

    const updatedBatches = passengerBatches.map(batch =>
      batch.id === batchId ? { ...batch, ...updates } : batch
    );

    const updatedScene = {
      ...selectedScene,
      passengerBatches: updatedBatches
    };

    const engine = new SimulationEngine(updatedScene);
    set({
      selectedScene: updatedScene,
      passengerBatches: updatedBatches,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  },

  addPassengerBatch: () => {
    const { selectedScene, passengerBatches } = get();
    if (!selectedScene) return;

    const newBatch: PassengerBatch = {
      id: `batch-${Date.now()}`,
      startTime: 0,
      count: 20,
      spawnX: 20,
      spawnY: 15,
      speed: 1.5
    };

    const updatedBatches = [...passengerBatches, newBatch];
    const updatedScene = {
      ...selectedScene,
      passengerBatches: updatedBatches
    };

    const engine = new SimulationEngine(updatedScene);
    set({
      selectedScene: updatedScene,
      passengerBatches: updatedBatches,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  },

  removePassengerBatch: (batchId: string) => {
    const { selectedScene, passengerBatches } = get();
    if (!selectedScene || passengerBatches.length <= 1) return;

    const updatedBatches = passengerBatches.filter(b => b.id !== batchId);
    const updatedScene = {
      ...selectedScene,
      passengerBatches: updatedBatches
    };

    const engine = new SimulationEngine(updatedScene);
    set({
      selectedScene: updatedScene,
      passengerBatches: updatedBatches,
      engine,
      passengers: [],
      bottlenecks: [],
      statistics: initialStatistics,
      currentTime: 0,
      isPlaying: false
    });
  },

  saveStrategyResult: (name: string) => {
    const { selectedScene, statistics, strategyResults } = get();
    if (!selectedScene) return;

    const result: StrategyResult = {
      id: `strategy-${Date.now()}`,
      name,
      scene: JSON.parse(JSON.stringify(selectedScene)),
      statistics: JSON.parse(JSON.stringify(statistics))
    };

    set({
      strategyResults: [...strategyResults, result]
    });
  },

  removeStrategyResult: (id: string) => {
    const { strategyResults } = get();
    set({
      strategyResults: strategyResults.filter(r => r.id !== id)
    });
  },

  clearStrategyResults: () => {
    set({ strategyResults: [] });
  }
}));
