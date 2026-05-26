import { create } from 'zustand';
import {
  GameState,
  GameStatus,
  EquipmentType,
  DispatchRecord,
  GameEvent,
  ReplayData,
  ReportData,
} from '../game/types';
import { getLevelById } from '../game/data/levels';
import { ScoreCalculator } from '../game/engine/ScoreCalculator';
import { PathFinder } from '../game/engine/PathFinder';
import { REPLAY_MAX_STORAGE } from '../game/data/constants';
import { getRequiredEquipment } from '../game/data/equipment';

const STORAGE_KEY = 'ski-rescue-replays';

interface GameStore {
  gameState: GameState;
  replayMode: boolean;
  replayData?: ReplayData;
  replayTime: number;
  currentGameId: string;
  gameStartTime: number;
  stateSnapshots: Array<{ time: number; state: Partial<GameState> }>;
  pathFinder: PathFinder | null;

  startGame: (levelId: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: (victory: boolean, reason?: string) => void;

  selectPatroller: (id: string) => void;
  selectVictim: (id: string) => void;
  toggleEquipment: (type: EquipmentType) => void;
  confirmDispatch: () => boolean;
  cancelSelection: () => void;

  updateGame: (deltaTime: number) => void;

  loadReplay: (replayId: string) => void;
  seekReplay: (time: number) => void;
  playReplay: () => void;
  pauseReplay: () => void;
  getReplayList: () => ReplayData[];
  deleteReplay: (id: string) => void;

  generateReport: () => ReportData;
  exportReportJSON: () => string;
}

const createInitialState = (levelId: string): GameState => {
  const level = getLevelById(levelId);
  if (!level) throw new Error(`Level ${levelId} not found`);

  return {
    status: 'playing',
    currentLevelId: levelId,
    timeElapsed: 0,
    timeLimit: level.timeLimit,
    score: 0,
    weather: level.initialWeather,
    weatherEndTime: 0,
    slopes: JSON.parse(JSON.stringify(level.slopes)),
    victims: JSON.parse(JSON.stringify(level.victims)),
    patrollers: JSON.parse(JSON.stringify(level.patrollers)),
    selectedEquipment: [],
    dispatchHistory: [],
    keyEvents: [],
  };
};

const saveReplayToStorage = (replay: ReplayData) => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const replays: ReplayData[] = existing ? JSON.parse(existing) : [];
    replays.unshift(replay);
    if (replays.length > REPLAY_MAX_STORAGE) {
      replays.pop();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(replays));
  } catch (e) {
    console.error('Failed to save replay:', e);
  }
};

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: createInitialState('level-1'),
  replayMode: false,
  replayTime: 0,
  currentGameId: '',
  gameStartTime: 0,
  stateSnapshots: [],
  pathFinder: null,

  startGame: (levelId: string) => {
    const gameId = `game-${Date.now()}`;
    const state = createInitialState(levelId);
    const pathFinder = new PathFinder(state.slopes);
    const startTime = Date.now();

    set({
      gameState: state,
      currentGameId: gameId,
      gameStartTime: startTime,
      stateSnapshots: [],
      pathFinder,
      replayMode: false,
      replayData: undefined,
      replayTime: 0,
    });
  },

  pauseGame: () => {
    set(state => ({
      gameState: { ...state.gameState, status: 'paused' as GameStatus },
    }));
  },

  resumeGame: () => {
    set(state => ({
      gameState: { ...state.gameState, status: 'playing' as GameStatus },
    }));
  },

  restartGame: () => {
    const { gameState } = get();
    const levelId = gameState.currentLevelId;
    const state = createInitialState(levelId);
    const pathFinder = new PathFinder(state.slopes);
    const newGameId = `game-${Date.now()}`;
    const startTime = Date.now();

    set({
      gameState: state,
      currentGameId: newGameId,
      gameStartTime: startTime,
      stateSnapshots: [],
      pathFinder,
      replayMode: false,
      replayData: undefined,
      replayTime: 0,
    });
  },

  endGame: (victory: boolean, reason?: string) => {
    const { gameState, currentGameId, gameStartTime, stateSnapshots } = get();
    const endTime = Date.now();

    set(state => ({
      gameState: {
        ...state.gameState,
        status: victory ? ('victory' as GameStatus) : ('defeat' as GameStatus),
        defeatReason: reason,
      },
    }));

    const replay: ReplayData = {
      id: currentGameId,
      levelId: gameState.currentLevelId,
      startTime: gameStartTime,
      endTime: endTime,
      finalScore: gameState.score,
      result: victory ? 'victory' : 'defeat',
      events: gameState.keyEvents,
      stateSnapshots: stateSnapshots,
    };
    saveReplayToStorage(replay);
  },

  selectPatroller: (id: string) => {
    const patroller = get().gameState.patrollers.find(p => p.id === id);
    if (!patroller || patroller.status !== 'idle') return;

    set(state => ({
      gameState: {
        ...state.gameState,
        selectedPatrollerId: id,
      },
    }));
  },

  selectVictim: (id: string) => {
    const victim = get().gameState.victims.find(v => v.id === id);
    if (!victim || victim.isRescued) return;

    set(state => ({
      gameState: {
        ...state.gameState,
        selectedVictimId: id,
      },
    }));
  },

  toggleEquipment: (type: EquipmentType) => {
    set(state => {
      const selected = state.gameState.selectedEquipment;
      const newSelected = selected.includes(type)
        ? selected.filter(e => e !== type)
        : [...selected, type];
      return {
        gameState: {
          ...state.gameState,
          selectedEquipment: newSelected,
        },
      };
    });
  },

  cancelSelection: () => {
    set(state => ({
      gameState: {
        ...state.gameState,
        selectedPatrollerId: undefined,
        selectedVictimId: undefined,
        selectedEquipment: [],
      },
    }));
  },

  confirmDispatch: () => {
    const { gameState, pathFinder } = get();
    const { selectedPatrollerId, selectedVictimId, selectedEquipment } = gameState;

    if (!selectedPatrollerId || !selectedVictimId) return false;

    const patroller = gameState.patrollers.find(p => p.id === selectedPatrollerId);
    const victim = gameState.victims.find(v => v.id === selectedVictimId);

    if (!patroller || !victim || patroller.status !== 'idle') return false;

    const requiredEquipment = getRequiredEquipment(victim.injury);
    const hasAllRequired = requiredEquipment.every(req =>
      selectedEquipment.some(used => used === req.type)
    );

    if (!hasAllRequired) {
      const missingEquipment = requiredEquipment
        .filter(req => !selectedEquipment.some(used => used === req.type))
        .map(req => req.type);
      const event: GameEvent = {
        timestamp: gameState.timeElapsed,
        type: 'warning',
        data: {
          message: `缺少必需装备: ${missingEquipment.join(', ')}`,
        },
      };
      set(state => ({
        gameState: {
          ...state.gameState,
          keyEvents: [...state.gameState.keyEvents, event],
        },
      }));
      return false;
    }

    const path = pathFinder?.findPath(
      patroller.position,
      victim.position,
      patroller,
      gameState.weather
    );

    if (!path) {
      const event: GameEvent = {
        timestamp: gameState.timeElapsed,
        type: 'warning',
        data: {
          message: '无法找到有效救援路线',
        },
      };
      set(state => ({
        gameState: {
          ...state.gameState,
          keyEvents: [...state.gameState.keyEvents, event],
        },
      }));
      return false;
    }

    const dispatchRecord: DispatchRecord = {
      id: `dispatch-${Date.now()}`,
      timestamp: gameState.timeElapsed,
      patrollerId: selectedPatrollerId,
      victimId: selectedVictimId,
      equipment: selectedEquipment,
      route: path.route,
      estimatedTime: path.estimatedTime,
      success: false,
    };

    const event: GameEvent = {
      timestamp: gameState.timeElapsed,
      type: 'dispatch',
      data: {
        patrollerId: selectedPatrollerId,
        victimId: selectedVictimId,
        equipment: selectedEquipment,
      },
    };

    set(state => ({
      gameState: {
        ...state.gameState,
        patrollers: state.gameState.patrollers.map(p =>
          p.id === selectedPatrollerId
            ? {
                ...p,
                status: 'dispatched' as const,
                currentVictimId: selectedVictimId,
                targetPosition: victim.position,
                dispatchStartTime: state.gameState.timeElapsed,
              }
            : p
        ),
        selectedPatrollerId: undefined,
        selectedVictimId: undefined,
        selectedEquipment: [],
        dispatchHistory: [...state.gameState.dispatchHistory, dispatchRecord],
        keyEvents: [...state.gameState.keyEvents, event],
      },
    }));

    return true;
  },

  updateGame: (deltaTime: number) => {
    const state = get().gameState;
    if (state.status !== 'playing') return;

    const newTimeElapsed = state.timeElapsed + deltaTime;
    const level = getLevelById(state.currentLevelId);

    let newScore = state.score;
    let newVictims = [...state.victims];
    let newPatrollers = [...state.patrollers];
    const newKeyEvents = [...state.keyEvents];
    const newDispatchHistory = [...state.dispatchHistory];
    let defeatReason: string | undefined;
    let gameEnded = false;

    if (newTimeElapsed >= state.timeLimit) {
      gameEnded = true;
      defeatReason = '救援时间耗尽';
    }

    let newWeather = state.weather;
    let newWeatherEndTime = state.weatherEndTime;

    if (level) {
      for (const event of level.weatherEvents) {
        if (
          newTimeElapsed >= event.time &&
          newTimeElapsed < event.time + event.duration &&
          state.timeElapsed < event.time
        ) {
          newWeather = event.type;
          newWeatherEndTime = event.time + event.duration;
          newKeyEvents.push({
            timestamp: newTimeElapsed,
            type: 'weather_change',
            data: { weather: event.type },
          });
        }
      }
    }

    newVictims = newVictims.map(victim => {
      if (victim.isRescued) return victim;

      const newTimeRemaining = victim.timeRemaining - deltaTime;
      const deteriorationThreshold = victim.maxTime * 0.3;

      if (newTimeRemaining <= 0) {
        gameEnded = true;
        defeatReason = `伤员 ${victim.name} 伤情恶化死亡`;
        return victim;
      }

      if (newTimeRemaining < deteriorationThreshold && victim.timeRemaining >= deteriorationThreshold) {
        newScore -= 100;
        newKeyEvents.push({
          timestamp: newTimeElapsed,
          type: 'deterioration',
          data: { victimId: victim.id, victimName: victim.name },
        });
      }

      return { ...victim, timeRemaining: newTimeRemaining };
    });

    newPatrollers = newPatrollers.map(patroller => {
      const elapsed = newTimeElapsed - (patroller.dispatchStartTime || 0);

      if (patroller.status === 'returning' && elapsed >= 15) {
        return {
          ...patroller,
          status: 'idle' as const,
          currentVictimId: undefined,
          targetPosition: undefined,
          position: { x: 0, y: 0, z: 0 },
        };
      }

      if (patroller.status !== 'dispatched' || !patroller.currentVictimId) {
        return patroller;
      }

      const victim = newVictims.find(v => v.id === patroller.currentVictimId);
      if (!victim) return patroller;

      const dispatchRecord = newDispatchHistory.find(
        d => d.patrollerId === patroller.id && d.victimId === patroller.currentVictimId && !d.success
      );

      if (dispatchRecord && elapsed >= dispatchRecord.estimatedTime) {
        const score = ScoreCalculator.calculateRescueScore(
          victim.injury,
          victim.timeRemaining,
          victim.maxTime,
          dispatchRecord.equipment,
          victim.timeRemaining < victim.maxTime * 0.3
        );
        newScore += score;

        const victimIndex = newVictims.findIndex(v => v.id === victim.id);
        if (victimIndex !== -1) {
          newVictims[victimIndex] = { ...victim, isRescued: true };
        }

        const recordIndex = newDispatchHistory.findIndex(d => d.id === dispatchRecord.id);
        if (recordIndex !== -1) {
          newDispatchHistory[recordIndex] = {
            ...dispatchRecord,
            success: true,
            actualTime: elapsed,
          };
        }

        newKeyEvents.push({
          timestamp: newTimeElapsed,
          type: 'rescue',
          data: {
            victimId: victim.id,
            victimName: victim.name,
            score,
          },
        });

        return {
          ...patroller,
          status: 'returning' as const,
          targetPosition: { x: 0, y: 0, z: 0 },
          dispatchStartTime: newTimeElapsed,
        };
      }

      return patroller;
    });

    const allRescued = newVictims.every(v => v.isRescued);
    if (allRescued && !gameEnded) {
      newKeyEvents.push({
        timestamp: newTimeElapsed,
        type: 'victory',
        data: { score: newScore },
      });
      get().endGame(true);
      return;
    }

    if (gameEnded) {
      newKeyEvents.push({
        timestamp: newTimeElapsed,
        type: 'defeat',
        data: { reason: defeatReason },
      });
      get().endGame(false, defeatReason);
      return;
    }

    const snapshotInterval = 0.5;
    const currentSnapshots = get().stateSnapshots;
    const lastSnapshotTime = currentSnapshots.length > 0 
      ? currentSnapshots[currentSnapshots.length - 1].time 
      : -snapshotInterval;
    
    if (newTimeElapsed - lastSnapshotTime >= snapshotInterval) {
      const newSnapshot = {
        time: newTimeElapsed,
        state: {
          timeElapsed: newTimeElapsed,
          score: newScore,
          weather: newWeather,
          victims: newVictims,
          patrollers: newPatrollers,
        },
      };
      set(state => ({
        stateSnapshots: [...state.stateSnapshots, newSnapshot],
      }));
    }

    set(state => ({
      gameState: {
        ...state.gameState,
        timeElapsed: newTimeElapsed,
        score: newScore,
        weather: newWeather,
        weatherEndTime: newWeatherEndTime,
        victims: newVictims,
        patrollers: newPatrollers,
        keyEvents: newKeyEvents,
        dispatchHistory: newDispatchHistory,
      },
    }));
  },

  loadReplay: (replayId: string) => {
    const replays = get().getReplayList();
    const replay = replays.find(r => r.id === replayId);
    if (!replay) return;

    set({
      replayMode: true,
      replayData: replay,
      replayTime: 0,
    });
  },

  seekReplay: (time: number) => {
    set({ replayTime: time });
  },

  playReplay: () => {},
  pauseReplay: () => {},

  getReplayList: () => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch {
      return [];
    }
  },

  deleteReplay: (id: string) => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const replays: ReplayData[] = existing ? JSON.parse(existing) : [];
      const filtered = replays.filter(r => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete replay:', e);
    }
  },

  generateReport: () => {
    const { gameState, currentGameId } = get();
    const level = getLevelById(gameState.currentLevelId);
    const breakdown = ScoreCalculator.getScoreBreakdown(gameState.dispatchHistory);
    const equipmentUsage = gameState.dispatchHistory.reduce((acc, d) => {
      d.equipment.forEach(e => {
        acc[e] = (acc[e] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const successfulRescues = gameState.dispatchHistory.filter(d => d.success);
    const avgResponseTime = successfulRescues.length > 0
      ? successfulRescues.reduce((sum, d) => sum + (d.actualTime || 0), 0) / successfulRescues.length
      : 0;

    return {
      gameId: currentGameId,
      levelName: level?.name || 'Unknown',
      finalScore: gameState.score,
      result: gameState.status === 'victory' ? 'victory' : 'defeat',
      totalTime: gameState.timeElapsed,
      victimsRescued: gameState.victims.filter(v => v.isRescued).length,
      totalVictims: gameState.victims.length,
      averageResponseTime: avgResponseTime,
      dispatchCount: gameState.dispatchHistory.length,
      equipmentUsage: equipmentUsage as never,
      scoreBreakdown: breakdown,
      events: gameState.keyEvents,
      defeatReason: gameState.defeatReason,
    };
  },

  exportReportJSON: () => {
    const report = get().generateReport();
    return JSON.stringify(report, null, 2);
  },
}));
