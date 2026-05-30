import { create } from 'zustand';
import {
  SimulationStore,
  DEFAULT_PARAMS,
  ANOMALY_RULES,
  SceneObject,
  Experiment,
} from '../types';
import { simulateStep, calculateTemperature, runFullSimulation } from '../physics/simulation';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createSceneObjects(): SceneObject[] {
  const objects: SceneObject[] = [];

  objects.push({
    id: 'track-main',
    name: '主轨道',
    type: 'track',
    position: [0, 0, 0],
    properties: { length: DEFAULT_PARAMS.trackLength },
    hasAnomaly: false,
    temperature: 25,
  });

  for (let i = 0; i < DEFAULT_PARAMS.stageCount; i++) {
    objects.push({
      id: `coil-${i + 1}`,
      name: `加速线圈 ${i + 1}`,
      type: 'coil',
      position: [(i + 0.5) * (DEFAULT_PARAMS.trackLength / DEFAULT_PARAMS.stageCount), 0, 0],
      properties: { stage: i + 1 },
      hasAnomaly: false,
      temperature: 25,
    });
  }

  objects.push({
    id: 'projectile-1',
    name: '弹丸 A',
    type: 'projectile',
    position: [0, 0, 0],
    properties: { mass: DEFAULT_PARAMS.projectileMass },
    hasAnomaly: false,
  });

  return objects;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  state: 'idle',
  currentTime: 0,
  projectilePosition: 0,
  projectileVelocity: 0,
  temperatures: { coil: 25, track: 25 },
  params: { ...DEFAULT_PARAMS },
  result: null,
  anomalies: [],
  objects: createSceneObjects(),
  focusedObjectId: null,

  actions: {
    setParams: (newParams) => {
      const current = get();
      const updatedParams = { ...current.params, ...newParams };

      const objects = [...current.objects];
      const coilCount = objects.filter((o) => o.type === 'coil').length;

      if (newParams.stageCount && newParams.stageCount !== coilCount) {
        const filtered = objects.filter((o) => o.type !== 'coil');
        for (let i = 0; i < newParams.stageCount; i++) {
          filtered.push({
            id: `coil-${i + 1}`,
            name: `加速线圈 ${i + 1}`,
            type: 'coil',
            position: [(i + 0.5) * (updatedParams.trackLength / newParams.stageCount), 0, 0],
            properties: { stage: i + 1 },
            hasAnomaly: false,
            temperature: 25,
          });
        }
        set({ params: updatedParams, objects: filtered });
      } else {
        set({ params: updatedParams });
      }

      const updated = get();
      get().actions.checkForAnomalies();
    },

    checkForAnomalies: () => {
      const current = get();
      const newAnomalies = [...current.anomalies];

      Object.entries(ANOMALY_RULES).forEach(([type, rule]) => {
        const exists = newAnomalies.some((a) => a.type === type && !a.resolved);
        if (rule.check(current.params, current.result || undefined)) {
          if (!exists) {
            newAnomalies.push({
              id: generateId(),
              type: type as any,
              severity: rule.severity,
              description: rule.description,
              suggestion: rule.suggestion,
              resolved: false,
              timestamp: new Date(),
            });
          }
        } else {
          const idx = newAnomalies.findIndex((a) => a.type === type && !a.resolved);
          if (idx !== -1) {
            newAnomalies[idx].resolved = true;
          }
        }
      });

      set({ anomalies: newAnomalies });
    },

    startSimulation: () => {
      set({
        state: 'running',
        currentTime: 0,
        projectilePosition: 0,
        projectileVelocity: 0,
        temperatures: { coil: 25, track: 25 },
        result: null,
      });
    },

    pauseSimulation: () => {
      set({ state: 'paused' });
    },

    resetSimulation: () => {
      set({
        state: 'idle',
        currentTime: 0,
        projectilePosition: 0,
        projectileVelocity: 0,
        temperatures: { coil: 25, track: 25 },
        result: null,
      });
    },

    updateSimulation: (deltaTime: number) => {
      const current = get();
      if (current.state !== 'running') return;

      const newTime = current.currentTime + deltaTime;
      const result = simulateStep(
        current.params,
        current.projectileVelocity,
        current.projectilePosition,
        deltaTime
      );

      const temps = calculateTemperature(current.params, newTime / 1000, 50);

      if (result.position >= current.params.trackLength) {
        const fullResult = runFullSimulation(current.params);
        set({
          state: 'completed',
          projectilePosition: result.position,
          projectileVelocity: result.velocity,
          currentTime: newTime,
          temperatures: temps,
          result: fullResult,
        });
        get().actions.checkForAnomalies();
      } else {
        set({
          projectilePosition: result.position,
          projectileVelocity: result.velocity,
          currentTime: newTime,
          temperatures: temps,
        });
      }
    },

    focusObject: (objectId) => {
      set({ focusedObjectId: objectId });
    },

    resolveAnomaly: (anomalyId) => {
      const current = get();
      const updated = current.anomalies.map((a) =>
        a.id === anomalyId ? { ...a, resolved: true } : a
      );
      set({ anomalies: updated });
    },

    addAnomaly: (anomaly) => {
      const current = get();
      set({
        anomalies: [...current.anomalies, { ...anomaly, id: generateId(), timestamp: new Date() }],
      });
    },
  },
}));

export function createExperimentFromState(): Experiment {
  const state = useSimulationStore.getState();
  return {
    id: generateId(),
    name: `实验 ${new Date().toLocaleString('zh-CN')}`,
    timestamp: new Date(),
    params: { ...state.params },
    result: state.result,
    anomalies: state.anomalies.map((a) => ({ ...a })),
    objects: state.objects.map((o) => ({ ...o })),
    status: state.result ? 'completed' : 'draft',
  };
}
