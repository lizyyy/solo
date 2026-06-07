import { create } from 'zustand';
import {
  TrainingState, DecisionStep, Obstacle, ResourceState, ActionType
} from '../types';
import { getRecordById } from '../data/mockRecords';
import {
  handleDragAction,
  handleClickAction,
} from '../utils/businessEngine';

interface TrainingStore extends TrainingState {
  startTraining: (recordId: string) => boolean;
  handleObstacleDrag: (obstacle: Obstacle) => void;
  handleObstacleClick: (obstacle: Obstacle) => void;
  togglePause: () => void;
  completeTraining: () => void;
  resolveConflict: () => void;
  resetTraining: () => void;
}

export const useTrainingStore = create<TrainingStore>((set, get) => ({
  currentRecordId: null,
  resources: {
    energy: 100,
    compute: 100,
    time: 100,
    score: 0,
    riskLevel: 0,
    isNegative: false,
  },
  decisionHistory: [],
  obstacles: [],
  isPaused: false,
  isCompleted: false,
  conflictResolved: false,

  startTraining: (recordId: string) => {
    const record = getRecordById(recordId);
    if (!record) return false;

    set({
      currentRecordId: recordId,
      resources: {
        energy: record.initialResources.energy,
        compute: record.initialResources.compute,
        time: record.initialResources.time,
        score: record.baseScore,
        riskLevel: 0,
        isNegative: false,
      },
      decisionHistory: [],
      obstacles: record.obstacles.map(o => ({ ...o, handled: false })),
      isPaused: false,
      isCompleted: false,
      conflictResolved: !!record.conflictData?.resolved || false,
    });

    return true;
  },

  handleObstacleDrag: (obstacle: Obstacle) => {
    const { resources, obstacles, currentRecordId } = get();
    if (!currentRecordId) return;

    const adjustedResources = resources.isNegative
      ? { ...resources, score: resources.score }
      : resources;

    const result = handleDragAction(adjustedResources, obstacle, resources.isNegative);
    const step: DecisionStep = {
      id: `step-${Date.now()}`,
      timestamp: Date.now(),
      actionType: 'drag' as ActionType,
      obstacleId: obstacle.id,
      resourceDelta: {
        energy: result.newResources.energy - resources.energy,
        compute: result.newResources.compute - resources.compute,
        time: result.newResources.time - resources.time,
      },
      scoreDelta: result.scoreDelta,
      riskLevel: result.newResources.riskLevel,
      description: result.description,
    };

    set({
      resources: result.newResources,
      decisionHistory: [...get().decisionHistory, step],
      obstacles: obstacles.map(o =>
        o.id === obstacle.id ? { ...o, handled: true } : o
      ),
    });
  },

  handleObstacleClick: (obstacle: Obstacle) => {
    const { resources, obstacles, currentRecordId } = get();
    if (!currentRecordId) return;

    const adjustedResources = resources.isNegative
      ? { ...resources, score: resources.score }
      : resources;

    const result = handleClickAction(adjustedResources, obstacle, resources.isNegative);
    const step: DecisionStep = {
      id: `step-${Date.now()}`,
      timestamp: Date.now(),
      actionType: 'click' as ActionType,
      obstacleId: obstacle.id,
      resourceDelta: {
        energy: result.newResources.energy - resources.energy,
        compute: result.newResources.compute - resources.compute,
        time: result.newResources.time - resources.time,
      },
      scoreDelta: result.scoreDelta,
      riskLevel: result.newResources.riskLevel,
      description: result.description,
    };

    set({
      resources: result.newResources,
      decisionHistory: [...get().decisionHistory, step],
      obstacles: obstacles.map(o =>
        o.id === obstacle.id ? { ...o, handled: true } : o
      ),
    });
  },

  togglePause: () => {
    const { isPaused, decisionHistory, resources } = get();
    const newPaused = !isPaused;

    const step: DecisionStep = {
      id: `step-${Date.now()}`,
      timestamp: Date.now(),
      actionType: newPaused ? 'pause' : 'resume',
      resourceDelta: { energy: 0, compute: 0, time: 0 },
      scoreDelta: 0,
      riskLevel: resources.riskLevel,
      description: newPaused ? '训练已暂停 - [人为中断记录]' : '训练已恢复',
    };

    set({
      isPaused: newPaused,
      decisionHistory: newPaused ? [...decisionHistory, step] : decisionHistory,
    });
  },

  completeTraining: () => {
    set({ isCompleted: true });
  },

  resolveConflict: () => {
    set({ conflictResolved: true });
  },

  resetTraining: () => {
    const { currentRecordId } = get();
    if (currentRecordId) {
      get().startTraining(currentRecordId);
    }
  },
}));
