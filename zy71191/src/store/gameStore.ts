import { create } from 'zustand';
import type {
  GameState,
  GamePhase,
  Booth,
  Crew,
  Task,
  Material,
  Inspection,
  GameEvent,
  PlayerAction,
  TaskType,
  InspectionType,
  ScoreBreakdown,
  TurnRecord,
} from '@/types/game';
import { INITIAL_SCORE_BREAKDOWN, TASK_CONFIG } from '@/types/game';
import { LEVELS, CREW_NAMES, BOOTH_NAMES, MATERIAL_NAMES } from '@/data/levels';
import {
  initializeBooths,
  initializeCrews,
  initializeMaterials,
  initializeInspections,
  processTurn,
  assignTask,
  requestInspection,
  emergencyDelivery,
  calculateScore,
} from '@/game/engine';

const generateId = () => Math.random().toString(36).substring(2, 9);

function createInitialState(): GameState {
  return {
    phase: 'menu',
    currentLevel: null,
    currentTurn: 0,
    maxTurns: 0,
    score: 0,
    scoreBreakdown: { ...INITIAL_SCORE_BREAKDOWN },
    booths: [],
    crews: [],
    tasks: [],
    materials: [],
    inspections: [],
    events: [],
    history: [],
    pendingActions: [],
    conflictDetected: false,
    emergencyUsed: 0,
    allMaterialsOnTime: true,
  };
}

export const useGameStore = create<GameState & {
  startGame: (levelId: number) => void;
  endTurn: () => void;
  assignCrewTask: (crewId: string, boothId: string, taskType: TaskType) => void;
  applyInspection: (type: InspectionType) => void;
  requestEmergency: (materialType: string, boothId: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  goToMenu: () => void;
  setPhase: (phase: GamePhase) => void;
  loadReplay: (levelId: number) => void;
  getReplayData: () => TurnRecord[];
}>((set, get) => ({
  ...createInitialState(),

  startGame: (levelId: number) => {
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level) return;

    const booths = initializeBooths(level.boothCount);
    const crews = initializeCrews(level.crewCount);
    const materials = initializeMaterials(level.boothCount, level.materialDelayChance);
    const inspections = initializeInspections();

    const state = get();
    const newHistory: TurnRecord[] = [];
    const snapshot = createSnapshot({
      ...state,
      currentLevel: level.id,
      currentTurn: 0,
      maxTurns: level.maxTurns,
      booths,
      crews,
      tasks: [],
      materials,
      inspections,
      events: [],
      history: newHistory,
      pendingActions: [],
      conflictDetected: false,
      emergencyUsed: 0,
      allMaterialsOnTime: true,
    });
    newHistory.push({
      turn: 0,
      actions: [],
      stateSnapshot: snapshot,
    });

    set({
      phase: 'playing',
      currentLevel: level.id,
      currentTurn: 0,
      maxTurns: level.maxTurns,
      score: 0,
      scoreBreakdown: { ...INITIAL_SCORE_BREAKDOWN },
      booths,
      crews,
      tasks: [],
      materials,
      inspections,
      events: [
        {
          id: generateId(),
          turn: 0,
          type: 'info',
          message: `关卡「${level.name}」开始！限定 ${level.maxTurns} 回合完成所有验收。`,
        },
      ],
      history: newHistory,
      pendingActions: [],
      conflictDetected: false,
      emergencyUsed: 0,
      allMaterialsOnTime: true,
    });
  },

  endTurn: () => {
    const state = get();
    if (state.phase !== 'playing') return;
    if (state.currentTurn > state.maxTurns) return;

    const action: PlayerAction = {
      type: 'end_turn',
      timestamp: Date.now(),
    };

    const nextTurn = state.currentTurn + 1;
    const result = processTurn({
      ...state,
      currentTurn: nextTurn,
      pendingActions: [...state.pendingActions, action],
    });

    const snapshot = createSnapshot({
      ...result,
      currentTurn: nextTurn,
    });

    const newHistory = [...result.history, {
      turn: nextTurn,
      actions: [...state.pendingActions, action],
      stateSnapshot: snapshot,
    }];

    const isVictory = result.inspections.every((i) => i.passed);
    const isTimeout = nextTurn > state.maxTurns && !isVictory;

    if (isVictory) {
      const scoreBreakdown = calculateScore(result, newHistory);
      if (state.currentLevel !== null) {
        localStorage.setItem(`exhibition-history-${state.currentLevel}`, JSON.stringify(newHistory));
      }
      set({
        ...result,
        currentTurn: nextTurn,
        phase: 'ended',
        history: newHistory,
        pendingActions: [],
        scoreBreakdown,
        score: scoreBreakdown.total,
        events: [
          ...result.events,
          {
            id: generateId(),
            turn: nextTurn,
            type: 'success',
            message: '🎉 所有验收通过！项目成功完成！',
          },
        ],
      });
    } else if (isTimeout) {
      const scoreBreakdown = calculateScore({ ...result, currentTurn: nextTurn }, newHistory);
      if (state.currentLevel !== null) {
        localStorage.setItem(`exhibition-history-${state.currentLevel}`, JSON.stringify(newHistory));
      }
      set({
        ...result,
        currentTurn: nextTurn,
        phase: 'ended',
        history: newHistory,
        pendingActions: [],
        scoreBreakdown,
        score: scoreBreakdown.total,
        events: [
          ...result.events,
          {
            id: generateId(),
            turn: nextTurn,
            type: 'error',
            message: '⏰ 超时！未能在限定回合内完成所有验收。',
          },
        ],
      });
    } else {
      set({
        ...result,
        currentTurn: nextTurn,
        history: newHistory,
        pendingActions: [],
      });
    }
  },

  assignCrewTask: (crewId: string, boothId: string, taskType: TaskType) => {
    const state = get();
    if (state.phase !== 'playing') return;

    const result = assignTask(state, crewId, boothId, taskType);
    if (!result) return;

    const action: PlayerAction = {
      type: 'assign_task',
      crewId,
      boothId,
      taskType,
      timestamp: Date.now(),
    };

    set({
      ...result,
      pendingActions: [...state.pendingActions, action],
    });
  },

  applyInspection: (type: InspectionType) => {
    const state = get();
    if (state.phase !== 'playing') return;

    const result = requestInspection(state, type);
    if (!result) return;

    const action: PlayerAction = {
      type: 'request_inspection',
      taskType: type === 'utilities' ? 'utilities' : type === 'structure' ? 'structure' : 'fire_safety',
      timestamp: Date.now(),
    };

    set({
      ...result,
      pendingActions: [...state.pendingActions, action],
    });
  },

  requestEmergency: (materialType: string, boothId: string) => {
    const state = get();
    if (state.phase !== 'playing') return;

    const result = emergencyDelivery(state, materialType, boothId);
    if (!result) return;

    const action: PlayerAction = {
      type: 'emergency_material',
      boothId,
      taskType: materialType === 'utilities' ? 'utilities' : materialType === 'structure' ? 'structure' : 'fire_safety',
      timestamp: Date.now(),
    };

    set({
      ...result,
      pendingActions: [...state.pendingActions, action],
    });
  },

  pauseGame: () => {
    const state = get();
    if (state.phase === 'playing') {
      set({ phase: 'paused' });
    }
  },

  resumeGame: () => {
    const state = get();
    if (state.phase === 'paused') {
      set({ phase: 'playing' });
    }
  },

  restartGame: () => {
    const state = get();
    if (state.currentLevel !== null) {
      get().startGame(state.currentLevel);
    }
  },

  goToMenu: () => {
    set({ ...createInitialState() });
  },

  setPhase: (phase: GamePhase) => {
    set({ phase });
  },

  loadReplay: (_levelId: number) => {
    // Replay data is loaded from history
  },

  getReplayData: () => {
    return get().history;
  },
}));

function createSnapshot(state: GameState): GameState {
  return {
    ...state,
    booths: state.booths.map((b) => ({ ...b })),
    crews: state.crews.map((c) => ({ ...c })),
    tasks: state.tasks.map((t) => ({ ...t })),
    materials: state.materials.map((m) => ({ ...m })),
    inspections: state.inspections.map((i) => ({ ...i })),
    events: state.events.map((e) => ({ ...e })),
    scoreBreakdown: { ...state.scoreBreakdown },
    pendingActions: [],
  };
}
