import { create } from 'zustand';
import { DataSource, StoneParams, TrajectoryPoint, CollisionEvent, AnalysisError, EvidenceLog, ICE_SHEET_LENGTH, DataSourceType } from '../types';
import { calculateTrajectory } from '../physics/trajectory';
import { detectAllCollisions } from '../physics/collision';
import { validateAllDataSources } from '../physics/errorAnalysis';

interface CurlingState {
  dataSources: DataSource[];
  selectedStoneId: string | null;
  trajectories: Map<string, TrajectoryPoint[]>;
  collisions: CollisionEvent[];
  errors: AnalysisError[];
  evidenceLogs: EvidenceLog[];
  simulation: {
    isPlaying: boolean;
    currentTime: number;
    speed: number;
    maxTime: number;
  };
  addDataSource: (source: { name: string; contributor: string; type: DataSourceType; stones: Omit<StoneParams, 'id' | 'sourceId'>[] }) => void;
  removeDataSource: (id: string) => void;
  updateStone: (stoneId: string, updates: Partial<StoneParams>) => void;
  selectStone: (id: string | null) => void;
  runSimulation: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setSimulationSpeed: (speed: number) => void;
  addEvidenceLog: (action: string, reason: string, dataSnapshot: unknown) => void;
  clearAll: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const createDemoData = (): DataSource[] => {
  const source1: DataSource = {
    id: generateId(),
    name: '张教练-出手数据',
    contributor: '张教练',
    timestamp: Date.now() - 3600000,
    type: 'raw',
    stones: [
      {
        id: generateId(),
        sourceId: '',
        color: 'yellow',
        initialVelocity: { x: 0.05, y: 1.8 },
        rotation: { direction: 'clockwise', speed: 30 },
        friction: 0.015,
        initialPosition: { x: 0, y: -ICE_SHEET_LENGTH / 2 + 1 }
      },
      {
        id: generateId(),
        sourceId: '',
        color: 'red',
        initialVelocity: { x: -0.08, y: 1.5 },
        rotation: { direction: 'counterclockwise', speed: 25 },
        friction: 0.012,
        initialPosition: { x: 0.5, y: -ICE_SHEET_LENGTH / 2 + 1 }
      }
    ]
  };
  source1.stones.forEach(s => s.sourceId = source1.id);

  const source2: DataSource = {
    id: generateId(),
    name: '李队员-摩擦记录',
    contributor: '李队员',
    timestamp: Date.now() - 1800000,
    type: 'processed',
    stones: [
      {
        id: generateId(),
        sourceId: '',
        color: 'yellow',
        initialVelocity: { x: 0.02, y: 2.0 },
        rotation: { direction: 'clockwise', speed: 35 },
        friction: 0.005,
        initialPosition: { x: -0.3, y: -ICE_SHEET_LENGTH / 2 + 1 }
      }
    ]
  };
  source2.stones.forEach(s => s.sourceId = source2.id);

  return [source1, source2];
};

export const useCurlingStore = create<CurlingState>((set, get) => {
  const demoData = createDemoData();
  const allStones = demoData.flatMap(s => s.stones);
  const trajectories = new Map<string, TrajectoryPoint[]>();
  
  allStones.forEach(stone => {
    trajectories.set(stone.id, calculateTrajectory(stone));
  });

  const collisions = detectAllCollisions(allStones, trajectories);
  const errors = validateAllDataSources(demoData);

  const maxTime = Math.max(
    ...Array.from(trajectories.values()).map(t => t[t.length - 1].timestamp),
    ...collisions.map(c => c.timestamp),
    10
  );

  return {
    dataSources: demoData,
    selectedStoneId: null,
    trajectories,
    collisions,
    errors,
    evidenceLogs: [
      {
        id: generateId(),
        timestamp: Date.now() - 3600000,
        action: '导入出手数据',
        reason: '训练后记录的冰壶出手参数',
        dataSnapshot: { source: demoData[0].name, stones: demoData[0].stones.length }
      }
    ],
    simulation: {
      isPlaying: false,
      currentTime: 0,
      speed: 1,
      maxTime
    },

    addDataSource: (source) => {
      const sourceId = generateId();
      const newSource: DataSource = {
        ...source,
        id: sourceId,
        timestamp: Date.now(),
        stones: source.stones.map(s => ({ ...s, id: generateId(), sourceId }))
      };

      set(state => {
        const newSources = [...state.dataSources, newSource];
        const allStones = newSources.flatMap(s => s.stones);
        const newTrajectories = new Map(state.trajectories);
        
        newSource.stones.forEach(stone => {
          newTrajectories.set(stone.id, calculateTrajectory(stone));
        });

        const newCollisions = detectAllCollisions(allStones, newTrajectories);
        const newErrors = validateAllDataSources(newSources);
        const newMaxTime = Math.max(
          ...Array.from(newTrajectories.values()).map(t => t[t.length - 1].timestamp),
          ...newCollisions.map(c => c.timestamp),
          10
        );

        return {
          dataSources: newSources,
          trajectories: newTrajectories,
          collisions: newCollisions,
          errors: newErrors,
          simulation: { ...state.simulation, maxTime: newMaxTime }
        };
      });

      get().addEvidenceLog('导入数据源', `添加了 ${source.name}`, { stones: source.stones.length });
    },

    removeDataSource: (id) => {
      set(state => {
        const source = state.dataSources.find(s => s.id === id);
        const newSources = state.dataSources.filter(s => s.id !== id);
        const removedStoneIds = source?.stones.map(s => s.id) || [];
        
        const newTrajectories = new Map(state.trajectories);
        removedStoneIds.forEach(sid => newTrajectories.delete(sid));

        const allStones = newSources.flatMap(s => s.stones);
        const newCollisions = detectAllCollisions(allStones, newTrajectories);
        const newErrors = validateAllDataSources(newSources);

        return {
          dataSources: newSources,
          trajectories: newTrajectories,
          collisions: newCollisions,
          errors: newErrors,
          selectedStoneId: removedStoneIds.includes(state.selectedStoneId || '') ? null : state.selectedStoneId
        };
      });

      get().addEvidenceLog('删除数据源', `移除了数据源 ${id}`, { sourceId: id });
    },

    updateStone: (stoneId, updates) => {
      set(state => {
        const newSources = state.dataSources.map(source => ({
          ...source,
          stones: source.stones.map(s =>
            s.id === stoneId ? { ...s, ...updates } : s
          )
        }));

        const allStones = newSources.flatMap(s => s.stones);
        const newTrajectories = new Map(state.trajectories);
        
        const stone = allStones.find(s => s.id === stoneId);
        if (stone) {
          newTrajectories.set(stoneId, calculateTrajectory(stone));
        }

        const newCollisions = detectAllCollisions(allStones, newTrajectories);
        const newErrors = validateAllDataSources(newSources);
        const newMaxTime = Math.max(
          ...Array.from(newTrajectories.values()).map(t => t[t.length - 1].timestamp),
          ...newCollisions.map(c => c.timestamp),
          10
        );

        return {
          dataSources: newSources,
          trajectories: newTrajectories,
          collisions: newCollisions,
          errors: newErrors,
          simulation: { ...state.simulation, maxTime: newMaxTime }
        };
      });
    },

    selectStone: (id) => set({ selectedStoneId: id }),

    runSimulation: () => {
      const state = get();
      const allStones = state.dataSources.flatMap(s => s.stones);
      const newTrajectories = new Map<string, TrajectoryPoint[]>();

      allStones.forEach(stone => {
        newTrajectories.set(stone.id, calculateTrajectory(stone));
      });

      const newCollisions = detectAllCollisions(allStones, newTrajectories);
      const newMaxTime = Math.max(
        ...Array.from(newTrajectories.values()).map(t => t[t.length - 1].timestamp),
        ...newCollisions.map(c => c.timestamp),
        10
      );

      set({
        trajectories: newTrajectories,
        collisions: newCollisions,
        simulation: { isPlaying: false, currentTime: 0, speed: state.simulation.speed, maxTime: newMaxTime }
      });

      get().addEvidenceLog('运行模拟', '重新计算所有轨迹和碰撞', { stones: allStones.length });
    },

    setPlaying: (isPlaying) => set(state => ({
      simulation: { ...state.simulation, isPlaying }
    })),

    setCurrentTime: (time) => set(state => ({
      simulation: { ...state.simulation, currentTime: time }
    })),

    setSimulationSpeed: (speed) => set(state => ({
      simulation: { ...state.simulation, speed }
    })),

    addEvidenceLog: (action, reason, dataSnapshot) => {
      set(state => ({
        evidenceLogs: [
          {
            id: generateId(),
            timestamp: Date.now(),
            action,
            reason,
            dataSnapshot
          },
          ...state.evidenceLogs
        ]
      }));
    },

    clearAll: () => set({
      dataSources: [],
      selectedStoneId: null,
      trajectories: new Map(),
      collisions: [],
      errors: [],
      evidenceLogs: [],
      simulation: { isPlaying: false, currentTime: 0, speed: 1, maxTime: 10 }
    })
  };
});
