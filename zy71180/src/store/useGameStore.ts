import { create } from 'zustand';
import {
  GameState,
  Level,
  RouteNode,
  GameEvent,
  GameHistory,
  ScoreBreakdown,
} from '../types/game';
import { GameEngine, ExecuteTurnResult } from '../engine/GameEngine';
import { saveGameHistory, getGameHistoryById } from '../utils/storage';
import { ScoreCalculator } from '../engine/ScoreCalculator';

interface GameStore extends GameState {
  engine: GameEngine | null;
  distanceMultiplier: number;
  routeValidation: { valid: boolean; reason?: string } | null;
  scoreBreakdown: ScoreBreakdown | null;
  currentHistory: GameHistory | null;
  replayHistory: GameHistory | null;

  startGame: (level: Level) => void;
  restartGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  goToMenu: () => void;

  addRouteNode: (node: RouteNode) => void;
  removeRouteNode: (index: number) => void;
  clearRoute: () => void;
  autoPlanRoute: () => void;

  checkEvent: () => GameEvent | null;
  applyEvent: (event: GameEvent) => void;
  dismissEvent: () => void;

  executeTurn: () => ExecuteTurnResult | null;
  setAnimating: (animating: boolean) => void;

  goToSettlement: (isWin: boolean, failureReason?: string) => void;
  startReplay: (historyId: string) => void;
  setReplayTurn: (turnIndex: number) => void;
  exitReplay: () => void;

  getScoreBreakdown: () => ScoreBreakdown | null;
}

const initialState: GameState = {
  level: null,
  restaurants: [],
  station: null,
  truck: null,
  currentTurn: 1,
  score: 0,
  complaints: 0,
  isPaused: false,
  isGameOver: false,
  isWin: false,
  failureReason: undefined,
  currentEvent: undefined,
  plannedRoute: [],
  turnHistory: [],
  gamePhase: 'menu',
  replayTurnIndex: 0,
  isAnimating: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  engine: null,
  distanceMultiplier: 1,
  routeValidation: null,
  scoreBreakdown: null,
  currentHistory: null,
  replayHistory: null,

  startGame: (level: Level) => {
    const engine = new GameEngine(level);
    const state = engine.getState();

    set({
      ...initialState,
      engine,
      level: state.level,
      restaurants: state.restaurants,
      station: state.station,
      truck: state.truck,
      currentTurn: state.currentTurn,
      score: state.score,
      complaints: state.complaints,
      turnHistory: state.turnHistory,
      distanceMultiplier: state.distanceMultiplier,
      gamePhase: 'playing',
      currentEvent: undefined,
      routeValidation: null,
      scoreBreakdown: null,
      currentHistory: null,
    });
  },

  restartGame: () => {
    const { level } = get();
    if (level) {
      get().startGame(level);
    }
  },

  pauseGame: () => set({ isPaused: true }),
  resumeGame: () => set({ isPaused: false }),

  goToMenu: () => {
    set({
      ...initialState,
      engine: null,
      routeValidation: null,
      scoreBreakdown: null,
      currentHistory: null,
      replayHistory: null,
    });
  },

  addRouteNode: (node: RouteNode) => {
    const { plannedRoute, engine } = get();
    if (!engine) return;

    const newRoute = [...plannedRoute, node];
    const validation = engine.validateRoute(newRoute);

    set({
      plannedRoute: newRoute,
      routeValidation: validation,
    });
  },

  removeRouteNode: (index: number) => {
    const { plannedRoute, engine } = get();
    if (!engine) return;

    const newRoute = plannedRoute.filter((_, i) => i !== index);
    const validation = newRoute.length > 0 ? engine.validateRoute(newRoute) : null;

    set({
      plannedRoute: newRoute,
      routeValidation: validation,
    });
  },

  clearRoute: () => {
    set({
      plannedRoute: [],
      routeValidation: null,
    });
  },

  autoPlanRoute: () => {
    const { engine } = get();
    if (!engine) return;

    const optimalRoute = engine.getOptimalRoute();
    const validation = engine.validateRoute(optimalRoute);

    set({
      plannedRoute: optimalRoute,
      routeValidation: validation,
    });
  },

  checkEvent: () => {
    const { engine } = get();
    if (!engine) return null;

    const event = engine.checkForEvent();
    if (event) {
      set({ currentEvent: event });
    }
    return event;
  },

  applyEvent: (event: GameEvent) => {
    const { engine } = get();
    if (!engine) return;

    engine.applyEvent(event);
    const state = engine.getState();

    set({
      restaurants: state.restaurants,
      truck: state.truck,
      score: state.score,
      complaints: state.complaints,
      distanceMultiplier: state.distanceMultiplier,
      currentEvent: undefined,
    });
  },

  dismissEvent: () => {
    set({ currentEvent: undefined });
  },

  executeTurn: () => {
    const { engine, plannedRoute } = get();
    if (!engine) return null;

    if (plannedRoute.length === 0) {
      return null;
    }

    try {
      const result = engine.executeTurn(plannedRoute);
      const state = engine.getState();

      set({
        restaurants: state.restaurants,
        station: state.station,
        truck: state.truck,
        currentTurn: state.currentTurn,
        score: state.score,
        complaints: state.complaints,
        turnHistory: state.turnHistory,
        distanceMultiplier: state.distanceMultiplier,
        plannedRoute: [],
        routeValidation: null,
        currentEvent: undefined,
      });

      if (result.isGameOver || result.isWin) {
        const history = engine.generateHistory(result.isWin, result.failureReason);
        saveGameHistory(history);

        const scoreBreakdown = ScoreCalculator.calculateFinalScore(
          state.turnHistory,
          state.level.maxTurns,
          result.isWin
        );

        set({
          isGameOver: result.isGameOver,
          isWin: result.isWin,
          failureReason: result.failureReason,
          gamePhase: 'settlement',
          currentHistory: history,
          scoreBreakdown,
        });
      }

      return result;
    } catch (error) {
      console.error('Execute turn error:', error);
      return null;
    }
  },

  setAnimating: (animating: boolean) => {
    set({ isAnimating: animating });
  },

  goToSettlement: (isWin: boolean, failureReason?: string) => {
    const { engine, turnHistory, level } = get();
    if (!engine || !level) return;

    const history = engine.generateHistory(isWin, failureReason);
    saveGameHistory(history);

    const scoreBreakdown = ScoreCalculator.calculateFinalScore(
      turnHistory,
      level.maxTurns,
      isWin
    );

    set({
      isGameOver: !isWin,
      isWin,
      failureReason,
      gamePhase: 'settlement',
      currentHistory: history,
      scoreBreakdown,
    });
  },

  startReplay: (historyId: string) => {
    const history = getGameHistoryById(historyId);
    if (!history) return;

    set({
      replayHistory: history,
      replayTurnIndex: 0,
      gamePhase: 'replay',
    });
  },

  setReplayTurn: (turnIndex: number) => {
    const { replayHistory } = get();
    if (!replayHistory) return;

    const clampedIndex = Math.max(0, Math.min(turnIndex, replayHistory.turns.length - 1));
    set({ replayTurnIndex: clampedIndex });
  },

  exitReplay: () => {
    set({
      replayHistory: null,
      replayTurnIndex: 0,
      gamePhase: 'menu',
    });
  },

  getScoreBreakdown: () => {
    const { turnHistory, level, isWin } = get();
    if (!level) return null;

    return ScoreCalculator.calculateFinalScore(turnHistory, level.maxTurns, isWin);
  },
}));
