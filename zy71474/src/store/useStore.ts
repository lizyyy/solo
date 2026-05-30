import { create } from 'zustand';
import { Ball, Experiment, CollisionResult, CollisionType, SimulationStatus, SampleGroup, AuditEntry, ImportBatch, TrajectoryFrame } from '@/types';
import { computeCollision, BALL_COLORS, computeMomentum, computeEnergy } from '@/engine/physics';
import { computeGroupId, classifyImport, buildSampleGroups } from '@/engine/grouping';
import { generateId } from '@/utils/helpers';

interface StoreState {
  balls: Ball[];
  collisionType: CollisionType;
  restitution: number;
  simulationStatus: SimulationStatus;
  currentResult: CollisionResult | null;
  trajectoryFrames: TrajectoryFrame[];
  currentFrameIndex: number;
  experiments: Experiment[];
  sampleGroups: SampleGroup[];
  importBatches: ImportBatch[];
  selectedExperimentId: string | null;

  addBall: () => void;
  removeBall: (id: string) => void;
  updateBall: (id: string, updates: Partial<Ball>) => void;
  setCollisionType: (type: CollisionType) => void;
  setRestitution: (e: number) => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setFrameIndex: (index: number) => void;
  setSimulationStatus: (status: SimulationStatus) => void;
  saveExperiment: (name: string) => void;
  importExperiments: (experiments: Experiment[]) => ImportBatch;
  deleteExperiment: (id: string) => void;
  selectExperiment: (id: string | null) => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const STORAGE_KEY = 'collision-platform-data';

function createDefaultBall(index: number): Ball {
  return {
    id: generateId(),
    mass: 1 + index * 2,
    velocity: index % 2 === 0 ? 5 : -3,
    positionX: 150 + index * 200,
    positionY: 200,
    radius: 20 + index * 5,
    color: BALL_COLORS[index % BALL_COLORS.length]
  };
}

export const useStore = create<StoreState>((set, get) => ({
  balls: [createDefaultBall(0), createDefaultBall(1)],
  collisionType: "elastic",
  restitution: 0.5,
  simulationStatus: "idle",
  currentResult: null,
  trajectoryFrames: [],
  currentFrameIndex: 0,
  experiments: [],
  sampleGroups: [],
  importBatches: [],
  selectedExperimentId: null,

  addBall: () => set(state => {
    if (state.balls.length >= 5) return state;
    const newBall = createDefaultBall(state.balls.length);
    return { balls: [...state.balls, newBall] };
  }),

  removeBall: (id) => set(state => ({
    balls: state.balls.filter(b => b.id !== id)
  })),

  updateBall: (id, updates) => set(state => ({
    balls: state.balls.map(b => b.id === id ? { ...b, ...updates } : b)
  })),

  setCollisionType: (type) => set({ collisionType: type }),

  setRestitution: (e) => set({ restitution: e }),

  startSimulation: () => {
    const state = get();
    const { afterBalls, result } = computeCollision(state.balls, state.collisionType, state.restitution);
    set({
      simulationStatus: "running",
      currentResult: result,
      trajectoryFrames: result.trajectoryFrames,
      currentFrameIndex: 0
    });
  },

  pauseSimulation: () => set({ simulationStatus: "paused" }),

  resetSimulation: () => set({
    simulationStatus: "idle",
    currentResult: null,
    trajectoryFrames: [],
    currentFrameIndex: 0
  }),

  setFrameIndex: (index) => set({ currentFrameIndex: index }),

  setSimulationStatus: (status) => set({ simulationStatus: status }),

  saveExperiment: (name) => {
    const state = get();
    const { result } = computeCollision(state.balls, state.collisionType, state.restitution);
    const groupId = computeGroupId(state.balls, state.collisionType);
    const auditLog: AuditEntry[] = [];
    const now = Date.now();

    state.balls.forEach(b => {
      if (b.mass <= 0) {
        auditLog.push({
          id: generateId(),
          experimentId: "",
          type: "zero_mass",
          severity: "critical",
          message: `小球 ${b.id.slice(0, 8)} 质量为零，已自动替换为极小值`,
          snapshot: { ballId: b.id, mass: b.mass },
          timestamp: now
        });
      }
    });

    if (result.energyAfter > result.energyBefore) {
      auditLog.push({
        id: generateId(),
        experimentId: "",
        type: "energy_increase",
        severity: "warning",
        message: `碰撞后能量增加 ${((result.energyAfter - result.energyBefore) / result.energyBefore * 100).toFixed(2)}%`,
        snapshot: { energyBefore: result.energyBefore, energyAfter: result.energyAfter },
        timestamp: now
      });
    }

    const experiment: Experiment = {
      id: generateId(),
      name,
      collisionType: state.collisionType,
      groupId,
      balls: [...state.balls],
      result,
      auditLog: auditLog.map(a => ({ ...a, experimentId: "" })),
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    experiment.auditLog = experiment.auditLog.map(a => ({ ...a, experimentId: experiment.id }));

    const experiments = [...state.experiments, experiment];
    const sampleGroups = buildSampleGroups(experiments);

    set({ experiments, sampleGroups });
    get().saveToStorage();
  },

  importExperiments: (incoming) => {
    const state = get();
    const items = classifyImport(state.experiments, incoming);
    const batch: ImportBatch = {
      id: generateId(),
      timestamp: Date.now(),
      items
    };

    const now = Date.now();
    const updatedExperiments = [...state.experiments];

    items.forEach((item, index) => {
      const exp = incoming[index];
      exp.importBatchId = batch.id;

      if (item.status === "new") {
        exp.version = 1;
        exp.createdAt = now;
        exp.updatedAt = now;
        exp.auditLog = [{
          id: generateId(),
          experimentId: exp.id,
          type: "import",
          severity: "info",
          message: "样例导入",
          snapshot: { batchId: batch.id },
          timestamp: now
        }];
        updatedExperiments.push(exp);
      } else if (item.status === "updated") {
        const prevIdx = updatedExperiments.findIndex(e => e.id === item.previousVersionId);
        if (prevIdx >= 0) {
          const prev = updatedExperiments[prevIdx];
          exp.version = prev.version + 1;
          exp.previousVersionId = prev.id;
          exp.createdAt = prev.createdAt;
          exp.updatedAt = now;
          exp.auditLog = [...prev.auditLog, {
            id: generateId(),
            experimentId: exp.id,
            type: "reupload",
            severity: "warning",
            message: `参数更新，变更字段: ${item.changedFields?.join(", ")}`,
            snapshot: { changedFields: item.changedFields, previousVersion: prev.id },
            timestamp: now
          }];
          updatedExperiments[prevIdx] = exp;
        } else {
          exp.version = 1;
          exp.createdAt = now;
          exp.updatedAt = now;
          updatedExperiments.push(exp);
        }
      }
    });

    const sampleGroups = buildSampleGroups(updatedExperiments);
    const importBatches = [...state.importBatches, batch];

    set({ experiments: updatedExperiments, sampleGroups, importBatches });
    get().saveToStorage();
    return batch;
  },

  deleteExperiment: (id) => {
    const state = get();
    const experiments = state.experiments.filter(e => e.id !== id);
    const sampleGroups = buildSampleGroups(experiments);
    set({ experiments, sampleGroups, selectedExperimentId: state.selectedExperimentId === id ? null : state.selectedExperimentId });
    get().saveToStorage();
  },

  selectExperiment: (id) => set({ selectedExperimentId: id }),

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const experiments = (data.experiments || []).map((e: Experiment) => {
          if (e.result && e.result.trajectoryFrames.length === 0 && e.balls.length > 0) {
            const { result: recomputed } = computeCollision(e.balls, e.collisionType, 0.5);
            return { ...e, result: recomputed };
          }
          return e;
        });
        const sampleGroups = buildSampleGroups(experiments);
        set({
          experiments,
          sampleGroups,
          importBatches: data.importBatches || []
        });
      }
    } catch {}
  },

  saveToStorage: () => {
    try {
      const state = get();
      const lightExperiments = state.experiments.map(e => ({
        ...e,
        result: e.result ? { ...e.result, trajectoryFrames: [] } : null
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        experiments: lightExperiments,
        sampleGroups: state.sampleGroups,
        importBatches: state.importBatches
      }));
    } catch {}
  }
}));
