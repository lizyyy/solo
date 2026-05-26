import { create } from 'zustand';
import type {
  GamePhase,
  Level,
  Position,
  GameEvent,
  CardType,
  Guard,
} from '../game/types';

interface GameState {
  phase: GamePhase;
  currentLevel: Level | null;
  currentRound: number;
  playerPosition: Position | null;
  plannedPath: Position[];
  executedPath: Position[];
  events: GameEvent[];
  availableCards: CardType[];
  desiccantCount: number;
  score: number;
  guards: Guard[];
  failReason: string | null;
  isDesiccantActive: boolean;
  showResult: boolean;

  setLevel: (level: Level) => void;
  planPath: (path: Position[]) => void;
  addToPath: (position: Position) => void;
  undoPath: () => void;
  clearPath: () => void;
  startExecution: () => void;
  executeStep: () => boolean;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  useDesiccant: () => void;
  finishGame: (success: boolean, failReason?: string) => void;
  addEvent: (event: GameEvent) => void;
  setShowResult: (show: boolean) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'planning',
  currentLevel: null,
  currentRound: 0,
  playerPosition: null,
  plannedPath: [],
  executedPath: [],
  events: [],
  availableCards: [],
  desiccantCount: 0,
  score: 0,
  guards: [],
  failReason: null,
  isDesiccantActive: false,
  showResult: false,

  setLevel: (level: Level) => {
    set({
      currentLevel: level,
      phase: 'planning',
      currentRound: 0,
      playerPosition: level.exhibit.startPosition,
      plannedPath: [],
      executedPath: [],
      events: [],
      availableCards: [...level.availableCards],
      desiccantCount: level.desiccantCount,
      score: 0,
      guards: level.guards.map((g) => ({ ...g })),
      failReason: null,
      isDesiccantActive: false,
      showResult: false,
    });
  },

  planPath: (path: Position[]) => {
    set({ plannedPath: path });
  },

  addToPath: (position: Position) => {
    const { plannedPath } = get();
    set({ plannedPath: [...plannedPath, position] });
  },

  undoPath: () => {
    const { plannedPath } = get();
    if (plannedPath.length > 0) {
      set({ plannedPath: plannedPath.slice(0, -1) });
    }
  },

  clearPath: () => {
    set({ plannedPath: [] });
  },

  startExecution: () => {
    const { plannedPath, playerPosition } = get();
    if (plannedPath.length === 0 || !playerPosition) return;

    set({
      phase: 'executing',
      currentRound: 0,
      executedPath: [playerPosition],
    });
  },

  executeStep: () => {
    const { plannedPath, executedPath, currentLevel, currentRound } = get();

    if (!currentLevel) return false;

    const nextIndex = executedPath.length;

    if (nextIndex >= plannedPath.length) {
      return true;
    }

    const nextPosition = plannedPath[nextIndex];

    const updatedGuards = get().guards.map((guard) => {
      if (guard.patrolPath.length <= 1) return guard;

      const nextPatrolIndex =
        (guard.currentPathIndex + 1) % guard.patrolPath.length;
      return {
        ...guard,
        currentPathIndex: nextPatrolIndex,
        position: guard.patrolPath[nextPatrolIndex],
      };
    });

    set({
      playerPosition: nextPosition,
      executedPath: [...executedPath, nextPosition],
      currentRound: currentRound + 1,
      guards: updatedGuards,
      isDesiccantActive: false,
    });

    return executedPath.length + 1 >= plannedPath.length;
  },

  pause: () => {
    const { phase } = get();
    if (phase === 'executing') {
      set({ phase: 'paused' });
    }
  },

  resume: () => {
    const { phase } = get();
    if (phase === 'paused') {
      set({ phase: 'executing' });
    }
  },

  restart: () => {
    const { currentLevel } = get();
    if (currentLevel) {
      get().setLevel(currentLevel);
    }
  },

  useDesiccant: () => {
    const { desiccantCount, phase } = get();
    if (desiccantCount > 0 && phase === 'executing') {
      set({
        desiccantCount: desiccantCount - 1,
        isDesiccantActive: true,
      });
    }
  },

  finishGame: (success: boolean, failReason?: string) => {
    set({
      phase: success ? 'completed' : 'failed',
      failReason: success ? null : failReason ?? null,
      showResult: true,
    });
  },

  setShowResult: (show: boolean) => {
    set({ showResult: show });
  },

  addEvent: (event: GameEvent) => {
    const { events, score } = get();
    set({
      events: [...events, event],
      score: score + event.scoreChange,
    });
  },
}));
