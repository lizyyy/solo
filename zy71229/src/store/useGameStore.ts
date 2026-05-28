import { create } from 'zustand';
import {
  GameState,
  DataSource,
  AnomalyStatus,
  RouteNode,
  Position,
  GameStateSnapshot,
  ReplayData,
  HistoryRecord,
} from '../game/types';
import {
  createInitialState,
  createRouteNode,
  calculateMoveTime,
  getPositionAtTime,
  markPatrolled,
  triggerAnomalies,
  processDecision,
  checkGameOver,
  calculateScore,
  calculateTotalScore,
  createSnapshot,
} from '../game/engine';
import { GAME_CONFIG } from '../game/config';
import { useHistoryStore } from './useHistoryStore';

interface GameStore {
  state: GameState;
  snapshots: GameStateSnapshot[];
  lastSnapshotTime: number;
  decisionStartTime: number | null;
  tick: (deltaTime: number) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setTimeScale: (scale: number) => void;
  addToRoute: (hallId: string, position: Position, type: RouteNode['type'], targetId: string) => void;
  removeFromRoute: (nodeId: string) => void;
  clearRoute: () => void;
  startMove: (target: Position) => void;
  updatePosition: () => void;
  handleAnomalyDecision: (anomalyId: string, choice: AnomalyStatus) => void;
  openAnomalyModal: (anomalyId: string) => void;
  closeAnomalyModal: () => void;
  markDataSourceViewed: (source: DataSource) => void;
  updateReportDraft: (text: string) => void;
  resetGame: () => void;
  finalizeGame: () => void;
  loadReplayState: (replayData: ReplayData) => void;
  setReplayTime: (time: number) => void;
}

const initialState = createInitialState();

export const useGameStore = create<GameStore>((set, get) => ({
  state: initialState,
  snapshots: [],
  lastSnapshotTime: 0,
  decisionStartTime: null,

  tick: (deltaTime: number) => {
    const { state, snapshots, lastSnapshotTime } = get();
    if (state.isPaused || state.isGameOver) return;

    const scaledDelta = deltaTime * state.timeScale;
    let newGameTime = state.gameTime + scaledDelta;

    if (newGameTime > state.totalTime) {
      newGameTime = state.totalTime;
    }

    let updates: Partial<GameState> = { gameTime: newGameTime };

    if (state.isMoving && state.moveTarget) {
      const newPosition = getPositionAtTime(
        state.currentPosition,
        state.moveTarget,
        state.moveStartTime,
        state.moveDuration,
        newGameTime
      );

      updates.currentPosition = newPosition;

      const moveProgress = (newGameTime - state.moveStartTime) / state.moveDuration;
      if (moveProgress >= 1) {
        updates.isMoving = false;
        updates.moveTarget = null;

        const hallUpdates = markPatrolled({ ...state, currentPosition: newPosition }, newPosition);
        Object.assign(updates, hallUpdates);

        if (state.plannedRoute.length > 0) {
          const remainingRoute = state.plannedRoute.slice(1);
          updates.plannedRoute = remainingRoute;

          if (remainingRoute.length > 0) {
            const nextNode = remainingRoute[0];
            const moveDuration = calculateMoveTime(newPosition, nextNode.position);
            updates.isMoving = true;
            updates.moveTarget = nextNode.position;
            updates.moveStartTime = newGameTime;
            updates.moveDuration = moveDuration;
          }
        }
      }
    }

    const position = updates.currentPosition || state.currentPosition;
    const patrolUpdates = markPatrolled({ ...state, ...updates, currentPosition: position }, position);
    Object.assign(updates, patrolUpdates);

    const anomalyUpdates = triggerAnomalies({ ...state, ...updates });
    if (anomalyUpdates) {
      Object.assign(updates, anomalyUpdates);
    }

    const gameOverUpdates = checkGameOver({ ...state, ...updates });
    if (gameOverUpdates) {
      Object.assign(updates, gameOverUpdates);
    }

    const newSnapshots = [...snapshots];
    if (newGameTime - lastSnapshotTime >= 1 || anomalyUpdates || gameOverUpdates) {
      const snapshot = createSnapshot({ ...state, ...updates }, anomalyUpdates ? 'anomaly_trigger' : 'tick');
      newSnapshots.push(snapshot);
    }

    set({
      state: { ...state, ...updates },
      snapshots: newSnapshots,
      lastSnapshotTime: newGameTime,
    });
  },

  startGame: () => {
    set(state => ({
      state: { ...state.state, isPaused: false },
    }));
  },

  pauseGame: () => {
    set(state => ({
      state: { ...state.state, isPaused: true },
    }));
  },

  resumeGame: () => {
    set(state => ({
      state: { ...state.state, isPaused: false },
    }));
  },

  setTimeScale: (scale: number) => {
    set(state => ({
      state: { ...state.state, timeScale: scale },
    }));
  },

  addToRoute: (hallId: string, position: Position, type: RouteNode['type'], targetId: string) => {
    const { state } = get();
    const lastPosition = state.plannedRoute.length > 0
      ? state.plannedRoute[state.plannedRoute.length - 1].position
      : state.currentPosition;

    const node = createRouteNode(hallId, position, type, targetId, lastPosition);

    set(state => ({
      state: {
        ...state.state,
        plannedRoute: [...state.state.plannedRoute, node],
      },
    }));

    const { markDataSourceViewed } = get();
    markDataSourceViewed(DataSource.ROUTE);
  },

  removeFromRoute: (nodeId: string) => {
    set(state => ({
      state: {
        ...state.state,
        plannedRoute: state.state.plannedRoute.filter(n => n.id !== nodeId),
      },
    }));
  },

  clearRoute: () => {
    set(state => ({
      state: { ...state.state, plannedRoute: [] },
    }));
  },

  startMove: (target: Position) => {
    const { state } = get();
    if (state.isMoving) return;

    const duration = calculateMoveTime(state.currentPosition, target);
    const snapshot = createSnapshot(state, 'move');

    set(state => ({
      state: {
        ...state.state,
        isMoving: true,
        moveTarget: target,
        moveStartTime: state.state.gameTime,
        moveDuration: duration,
      },
      snapshots: [...state.snapshots, snapshot],
    }));
  },

  updatePosition: () => {},

  handleAnomalyDecision: (anomalyId: string, choice: AnomalyStatus) => {
    const { state, decisionStartTime } = get();
    if (decisionStartTime === null) return;

    const { updates, decision } = processDecision(
      state,
      anomalyId,
      choice,
      decisionStartTime
    );

    const snapshot = createSnapshot({ ...state, ...updates }, 'decision');

    set(state => ({
      state: { ...state.state, ...updates },
      snapshots: [...state.snapshots, snapshot],
      decisionStartTime: null,
    }));
  },

  openAnomalyModal: (anomalyId: string) => {
    set(state => ({
      state: { ...state.state, activeAnomalyId: anomalyId, isPaused: true },
      decisionStartTime: state.state.gameTime,
    }));
  },

  closeAnomalyModal: () => {
    set(state => ({
      state: { ...state.state, activeAnomalyId: null, isPaused: false },
      decisionStartTime: null,
    }));
  },

  markDataSourceViewed: (source: DataSource) => {
    set(state => {
      const newViewed = { ...state.state.viewedDataSources };
      newViewed[source] = [...newViewed[source], state.state.gameTime];
      return {
        state: { ...state.state, viewedDataSources: newViewed },
      };
    });
  },

  updateReportDraft: (text: string) => {
    set(state => ({
      state: { ...state.state, reportDraft: text },
    }));

    const { markDataSourceViewed } = get();
    markDataSourceViewed(DataSource.REPORT);
  },

  resetGame: () => {
    const newState = createInitialState();
    set({
      state: newState,
      snapshots: [],
      lastSnapshotTime: 0,
      decisionStartTime: null,
    });
  },

  finalizeGame: () => {
    const { state, snapshots } = get();
    const score = calculateScore(state);
    const totalScore = calculateTotalScore(score);

    const finalState = {
      ...state,
      score,
      totalScore,
      isGameOver: true,
      endTime: Date.now(),
    };

    const replayData: ReplayData = {
      gameId: state.id,
      snapshots,
      decisions: state.decisions,
      anomalies: state.anomalies,
      halls: state.halls,
      corners: state.corners,
      artworks: state.artworks,
      doors: state.doors,
      lights: state.lights,
      finalScore: totalScore,
      startTime: state.startTime,
      endTime: finalState.endTime!,
    };

    const historyStore = useHistoryStore.getState();
    const replayId = historyStore.saveReplay(replayData);

    const historyRecord: HistoryRecord = {
      id: Date.now().toString(),
      gameId: state.id,
      startTime: state.startTime,
      endTime: finalState.endTime!,
      finalScore: totalScore,
      totalAnomalies: state.anomalies.length,
      correctDecisions: state.decisions.filter(d => d.isCorrect).length,
      totalDecisions: state.decisions.length,
      replayDataId: replayId,
    };

    historyStore.saveHistory(historyRecord);

    set({ state: finalState });
  },

  loadReplayState: (replayData: ReplayData) => {
    const initialSnapshot = replayData.snapshots[0];
    set({
      state: {
        ...createInitialState(),
        ...replayData,
        ...initialSnapshot?.gameState,
        id: replayData.gameId,
        gameTime: 0,
        isPaused: true,
        isGameOver: false,
        score: [],
        totalScore: replayData.finalScore,
      },
      snapshots: replayData.snapshots,
      lastSnapshotTime: 0,
      decisionStartTime: null,
    });
  },

  setReplayTime: (time: number) => {
    const { state, snapshots } = get();
    
    const relevantSnapshot = snapshots
      .filter(s => s.timestamp <= time)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (relevantSnapshot) {
      set({
        state: {
          ...state,
          ...relevantSnapshot.gameState,
          gameTime: time,
        },
      });
    }
  },
}));
