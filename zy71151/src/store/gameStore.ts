import { create } from 'zustand';
import { GameState, GameStore, Ship, Tug, HistoryFrame } from '../types';
import { getLevelById } from '../data/levels';
import { ScoringSystem } from '../engine/ScoringSystem';
import { TideSystem } from '../engine/TideSystem';

const sessionHistories: Record<string, HistoryFrame[]> = {};

export const getSessionHistory = (sessionId: string): HistoryFrame[] | undefined => {
  return sessionHistories[sessionId];
};

const createInitialState = (levelId: string): GameState | null => {
  const level = getLevelById(levelId);
  if (!level) return null;

  const ships: Ship[] = level.initialShips.map((ship) => ({
    ...ship,
    assignedTugIds: [],
  }));

  const tugs: Tug[] = level.initialTugs.map((tug) => ({
    ...tug,
    rotation: 0,
  }));

  const initialTide = TideSystem.updateTide(
    {
      ...level.tide,
      currentLevel: level.tide.minLevel,
    },
    0
  );

  return {
    phase: 'playing',
    time: 0,
    timeSpeed: 1,
    maxTime: level.duration,
    levelId,
    score: ScoringSystem.calculateInitialScore(),
    ships,
    tugs,
    berths: level.berths,
    tide: initialTide,
    events: [],
    collisionWarnings: [],
    history: [],
    objectives: JSON.parse(JSON.stringify(level.objectives)),
    failReason: 'none',
  };
};

export const useGameStore = create<GameStore>((set, get) => ({
  state: null as unknown as GameState,

  actions: {
    startGame: (levelId: string) => {
      const initialState = createInitialState(levelId);
      if (initialState) {
        set({ state: initialState });
      }
    },

    pauseGame: () => {
      set((store) => ({
        state: { ...store.state, phase: 'paused' },
      }));
    },

    resumeGame: () => {
      set((store) => ({
        state: { ...store.state, phase: 'playing' },
      }));
    },

    resetGame: () => {
      const { state } = get();
      if (state) {
        const initialState = createInitialState(state.levelId);
        if (initialState) {
          set({ state: initialState });
        }
      }
    },

    setTimeSpeed: (speed: number) => {
      set((store) => ({
        state: { ...store.state, timeSpeed: speed },
      }));
    },

    assignTug: (tugId: string, shipId: string) => {
      set((store) => {
        const newTugs = store.state.tugs.map((tug) => {
          if (tug.id === tugId && tug.status === 'idle' && tug.fuel > 0) {
            return {
              ...tug,
              status: 'moving' as const,
              assignedShipId: shipId,
            };
          }
          return tug;
        });

        const newShips = store.state.ships.map((ship) => {
          if (ship.id === shipId) {
            const hasTug = ship.assignedTugIds.includes(tugId);
            return {
              ...ship,
              assignedTugIds: hasTug ? ship.assignedTugIds : [...ship.assignedTugIds, tugId],
            };
          }
          return ship;
        });

        return {
          state: {
            ...store.state,
            tugs: newTugs,
            ships: newShips,
          },
        };
      });
    },

    recallTug: (tugId: string) => {
      set((store) => {
        const tug = store.state.tugs.find((t) => t.id === tugId);
        const shipId = tug?.assignedShipId;

        const newTugs = store.state.tugs.map((t) => {
          if (t.id === tugId) {
            return {
              ...t,
              status: 'returning' as const,
              assignedShipId: undefined,
            };
          }
          return t;
        });

        const newShips = store.state.ships.map((ship) => {
          if (ship.id === shipId) {
            return {
              ...ship,
              assignedTugIds: ship.assignedTugIds.filter((id) => id !== tugId),
            };
          }
          return ship;
        });

        return {
          state: {
            ...store.state,
            tugs: newTugs,
            ships: newShips,
          },
        };
      });
    },

    selectTug: (tugId?: string) => {
      set((store) => ({
        state: { ...store.state, selectedTugId: tugId, selectedShipId: undefined },
      }));
    },

    selectShip: (shipId?: string) => {
      set((store) => ({
        state: { ...store.state, selectedShipId: shipId, selectedTugId: undefined },
      }));
    },

    endGame: (reason?) => {
      set((store) => {
        const sessionId = `session-${Date.now()}`;
        sessionHistories[sessionId] = store.state.history;
        return {
          state: {
            ...store.state,
            phase: 'ended',
            failReason: reason || store.state.failReason,
            levelId: sessionId,
          },
        };
      });
    },

    exportReport: () => {
      const { state } = get();
      if (!state) return '';

      const level = getLevelById(state.levelId);
      const levelName = level?.name || '未知关卡';

      const failReasons: Record<string, string> = {
        collision: '发生碰撞事故',
        fuel_depleted: '燃油耗尽',
        tide_missed: '错过潮汐窗口',
        time_out: '超时',
        none: '正常完成',
      };

      const allObjectivesCompleted = state.objectives.every((o) => o.completed);
      const isWin = state.failReason === 'none' && allObjectivesCompleted;
      const resultText = isWin ? '✅ 任务成功' : '❌ 任务失败';

      let endReason = failReasons[state.failReason] || '未知';
      if (state.failReason === 'none' && !allObjectivesCompleted) {
        endReason = '目标未完成';
      }

      const report = `
=========================================
      港口拖轮调度报告
=========================================

关卡: ${levelName}
结果: ${resultText}
总时长: ${Math.floor(state.time / 60)}分${Math.floor(state.time % 60)}秒
结束原因: ${endReason}

=========================================
      评分详情
=========================================

按时完成奖励: ${state.score.onTimeCompletions} 分
燃油效率奖励: ${state.score.fuelEfficiency} 分
安全评分: ${state.score.safetyScore} 分
扣分项: ${state.score.penalties} 分
------------------------
总分: ${state.score.total} 分
评级: ${state.score.grade}

=========================================
      目标完成情况
=========================================
${state.objectives
  .map((obj) => `[${obj.completed ? '✓' : '✗'}] ${obj.description} (${obj.currentValue}/${obj.targetValue})`)
  .join('\n')}

=========================================
      关键事件
=========================================
${state.events
  .slice(-20)
  .map((e) => `[${Math.floor(e.time / 60)}:${(e.time % 60).toString().padStart(2, '0')}] ${e.message}`)
  .join('\n')}

=========================================
      船舶状态
=========================================
${state.ships
  .map(
    (ship) =>
      `${ship.name}: ${ship.status} | 所需拖轮: ${ship.requiredTugs} | 已分配: ${ship.assignedTugIds.length}`
  )
  .join('\n')}

=========================================
      拖轮状态
=========================================
${state.tugs
  .map(
    (tug) =>
      `${tug.name}: ${tug.status} | 燃油: ${Math.round(tug.fuel)}/${tug.maxFuel} | 分配: ${tug.assignedShipId || '无'}`
  )
  .join('\n')}

=========================================
      报告生成时间: ${new Date().toLocaleString()}
=========================================
      `;

      return report;
    },

    loadHistory: (history: HistoryFrame[]) => {
      if (history.length > 0) {
        const frame = history[0];
        set((store) => ({
          state: {
            ...store.state,
            time: frame.time,
            ships: frame.ships,
            tugs: frame.tugs,
            tide: frame.tide,
            history,
          },
        }));
      }
    },

    setPlaybackTime: (time: number) => {
      const { state } = get();
      const history = state.history;
      if (history.length === 0) return;

      let frame = history[0];
      for (let i = 0; i < history.length; i++) {
        if (history[i].time <= time) {
          frame = history[i];
        } else {
          break;
        }
      }

      set((store) => ({
        state: {
          ...store.state,
          time: frame.time,
          ships: frame.ships,
          tugs: frame.tugs,
          tide: frame.tide,
        },
      }));
    },
  },
}));

export const useGameState = () => useGameStore((s) => s.state);
export const useGameActions = () => useGameStore((s) => s.actions);
