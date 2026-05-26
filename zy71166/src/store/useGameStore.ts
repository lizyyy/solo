import { create } from 'zustand';
import type {
  GameState,
  Rack,
  ACUnit,
  ACStatus,
  TurnState,
  Operation,
  GameEvent,
  LevelConfig,
  TurnSnapshot,
} from '../engine/types';
import { createInitialGameState, createTurnSnapshot } from '../engine/init';
import { calculateTemperatureChange } from '../engine/physics';
import { checkFailureConditions, calculateTurnScore } from '../engine/rules';
import { generateRandomEvent, applyEventEffects, tryMigrateLoad } from '../engine/events';
import { getElectricityPrice, getLevelById } from '../engine/config';
import { saveReplay } from '../engine/replay';

interface GameStore extends GameState {
  levelConfig: LevelConfig | null;
  actionMessage: string | null;
  initGame: (levelId: string) => void;
  resetGame: () => void;
  toggleAC: (acId: string) => void;
  setACSetPoint: (acId: string, temperature: number) => void;
  migrateLoad: (fromRackId: string, toRackId: string, amount: number) => void;
  nextTurn: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setActionMessage: (msg: string | null) => void;
  loadSnapshot: (snapshot: TurnSnapshot) => void;
  clearStore: () => void;
}

function generateOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: '',
  levelId: '',
  levelName: '',
  levelConfig: null,
  racks: [],
  acUnits: [],
  turnState: {
    turn: 1,
    hour: 0,
    outdoorTemp: 25,
    electricityPrice: 0.5,
    pricePeriod: 'flat',
    electricityUsed: 0,
    totalCost: 0,
    score: 0,
    budget: 0,
  },
  gamePhase: 'playing',
  failReason: null,
  operationLog: [],
  eventLog: [],
  snapshotHistory: [],
  totalTurns: 24,
  createdAt: 0,
  actionMessage: null,

  initGame: (levelId: string) => {
    const level = getLevelById(levelId);
    if (!level) return;

    const initialState = createInitialGameState(level);
    set({
      ...initialState,
      levelConfig: level,
      actionMessage: null,
    });
  },

  resetGame: () => {
    const state = get();
    if (!state.levelConfig) return;

    const initialState = createInitialGameState(state.levelConfig);
    set({
      ...initialState,
      levelConfig: state.levelConfig,
      actionMessage: null,
    });
  },

  toggleAC: (acId: string) => {
    const state = get();
    if (state.gamePhase !== 'playing') return;

    const ac = state.acUnits.find((a) => a.id === acId);
    if (!ac) return;

    const newACUnits = state.acUnits.map((a) => {
      if (a.id === acId) {
        return {
          ...a,
          isOn: !a.isOn,
          status: (!a.isOn ? 'running' : 'off') as ACStatus,
          powerDraw: !a.isOn ? a.capacity / 3.5 : 0,
        };
      }
      return a;
    });

    const op: Operation = {
      id: generateOpId(),
      turn: state.turnState.turn,
      type: 'ac_toggle',
      payload: { acId, isOn: !ac.isOn },
      timestamp: Date.now(),
    };

    set({
      acUnits: newACUnits,
      operationLog: [...state.operationLog, op],
      actionMessage: `${ac.name} 已${!ac.isOn ? '开启' : '关闭'}`,
    });
  },

  setACSetPoint: (acId: string, temperature: number) => {
    const state = get();
    if (state.gamePhase !== 'playing') return;

    const ac = state.acUnits.find((a) => a.id === acId);
    if (!ac) return;

    const newTemp = Math.max(18, Math.min(30, temperature));
    const newACUnits = state.acUnits.map((a) =>
      a.id === acId ? { ...a, setPoint: newTemp } : a,
    );

    const op: Operation = {
      id: generateOpId(),
      turn: state.turnState.turn,
      type: 'ac_setpoint',
      payload: { acId, temperature: newTemp },
      timestamp: Date.now(),
    };

    set({
      acUnits: newACUnits,
      operationLog: [...state.operationLog, op],
      actionMessage: `${ac.name} 设定温度调整为 ${newTemp}°C`,
    });
  },

  migrateLoad: (fromRackId: string, toRackId: string, amount: number) => {
    const state = get();
    if (state.gamePhase !== 'playing' || !state.levelConfig) return;

    const result = tryMigrateLoad(state.racks, fromRackId, toRackId, amount, state.levelConfig);

    const op: Operation = {
      id: generateOpId(),
      turn: state.turnState.turn,
      type: 'migrate_load',
      payload: { fromRackId, toRackId, amount, success: result.success },
      timestamp: Date.now(),
    };

    if (result.success) {
      set({
        racks: result.racks,
        operationLog: [...state.operationLog, op],
        actionMessage: result.message,
      });
    } else {
      const event: GameEvent = {
        id: `evt-${Date.now()}-migfail`,
        turn: state.turnState.turn,
        hour: state.turnState.hour,
        type: 'migrate_fail',
        message: result.message,
        severity: 'warning',
        timestamp: Date.now(),
      };
      set({
        operationLog: [...state.operationLog, op],
        eventLog: [...state.eventLog, event],
        actionMessage: result.message,
      });
    }
  },

  nextTurn: () => {
    const state = get();
    if (state.gamePhase !== 'playing' || !state.levelConfig) return;

    let { racks, acUnits, turnState, eventLog } = state;

    const { newRacks, newACUnits, totalElectricityUsed } = calculateTemperatureChange(
      racks,
      acUnits,
      turnState.outdoorTemp,
    );
    racks = newRacks;
    acUnits = newACUnits;

    const failureCheck = checkFailureConditions(racks, acUnits, turnState);
    if (failureCheck.gameOver) {
      const finalTurnState = {
        ...turnState,
        electricityUsed: totalElectricityUsed,
        totalCost: Math.round((turnState.totalCost + totalElectricityUsed * turnState.electricityPrice) * 100) / 100,
      };

      const snapshot = createTurnSnapshot(turnState.turn, racks, acUnits, finalTurnState);
      const finalGameState = {
        ...state,
        racks,
        acUnits,
        turnState: finalTurnState,
        gamePhase: 'lost' as const,
        failReason: failureCheck.failReason,
        eventLog: [...eventLog, ...failureCheck.events],
        snapshotHistory: [...state.snapshotHistory, snapshot],
      };

      saveReplay(finalGameState);

      set({
        racks,
        acUnits,
        turnState: finalTurnState,
        gamePhase: 'lost',
        failReason: failureCheck.failReason,
        eventLog: [...eventLog, ...failureCheck.events],
        snapshotHistory: [...state.snapshotHistory, snapshot],
        actionMessage: failureCheck.failReason,
      });
      return;
    }
    eventLog = [...eventLog, ...failureCheck.events];

    const randomEvent = generateRandomEvent(
      turnState.turn,
      turnState.hour,
      racks,
      acUnits,
      state.levelConfig.eventProbability,
    );
    if (randomEvent) {
      const effects = applyEventEffects(randomEvent, racks, acUnits);
      racks = effects.racks;
      acUnits = effects.acUnits;
      eventLog.push(randomEvent);
    }

    const { scoreDelta } = calculateTurnScore(racks, turnState, totalElectricityUsed);

    const nextTurn = turnState.turn + 1;
    const nextHour = nextTurn % 24;
    const nextOutdoorTemp = state.levelConfig.outdoorTempCurve[nextHour];
    const { price, period } = getElectricityPrice(nextHour, state.levelConfig);

    const turnCost = totalElectricityUsed * turnState.electricityPrice;
    const newTotalCost = Math.round((turnState.totalCost + turnCost) * 100) / 100;
    const newScore = turnState.score + scoreDelta;

    const nextTurnState: TurnState = {
      turn: nextTurn,
      hour: nextHour,
      outdoorTemp: nextOutdoorTemp,
      electricityPrice: price,
      pricePeriod: period,
      electricityUsed: totalElectricityUsed,
      totalCost: newTotalCost,
      score: newScore,
      budget: turnState.budget,
    };

    const snapshot = createTurnSnapshot(turnState.turn, racks, acUnits, {
      ...turnState,
      electricityUsed: totalElectricityUsed,
      totalCost: newTotalCost,
      score: newScore,
    });

    const op: Operation = {
      id: generateOpId(),
      turn: turnState.turn,
      type: 'next_turn',
      payload: { scoreDelta, turnCost },
      timestamp: Date.now(),
    };

    if (nextTurn > state.totalTurns) {
      const finalGameState = {
        ...state,
        racks,
        acUnits,
        turnState: { ...nextTurnState, turn: turnState.turn },
        gamePhase: 'won' as const,
        eventLog,
        operationLog: [...state.operationLog, op],
        snapshotHistory: [...state.snapshotHistory, snapshot],
      };
      saveReplay(finalGameState);

      set({
        racks,
        acUnits,
        turnState: { ...nextTurnState, turn: turnState.turn },
        gamePhase: 'won',
        eventLog,
        operationLog: [...state.operationLog, op],
        snapshotHistory: [...state.snapshotHistory, snapshot],
        actionMessage: `挑战成功！最终得分：${newScore}`,
      });
      return;
    }

    set({
      racks,
      acUnits,
      turnState: nextTurnState,
      eventLog,
      operationLog: [...state.operationLog, op],
      snapshotHistory: [...state.snapshotHistory, snapshot],
      actionMessage: `回合 ${turnState.turn} 完成，得分 ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`,
    });
  },

  pauseGame: () => {
    const state = get();
    if (state.gamePhase !== 'playing') return;
    set({ gamePhase: 'paused' });
  },

  resumeGame: () => {
    const state = get();
    if (state.gamePhase !== 'paused') return;
    set({ gamePhase: 'playing' });
  },

  setActionMessage: (msg: string | null) => {
    set({ actionMessage: msg });
  },

  loadSnapshot: (snapshot: TurnSnapshot) => {
    set({
      racks: JSON.parse(JSON.stringify(snapshot.racks)),
      acUnits: JSON.parse(JSON.stringify(snapshot.acUnits)),
      turnState: JSON.parse(JSON.stringify(snapshot.turnState)),
    });
  },

  clearStore: () => {
    set({
      gameId: '',
      levelId: '',
      levelName: '',
      levelConfig: null,
      racks: [],
      acUnits: [],
      turnState: {
        turn: 1,
        hour: 0,
        outdoorTemp: 25,
        electricityPrice: 0.5,
        pricePeriod: 'flat',
        electricityUsed: 0,
        totalCost: 0,
        score: 0,
        budget: 0,
      },
      gamePhase: 'playing',
      failReason: null,
      operationLog: [],
      eventLog: [],
      snapshotHistory: [],
      totalTurns: 24,
      createdAt: 0,
      actionMessage: null,
    });
  },
}));
