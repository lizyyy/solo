import { create } from 'zustand';
import type { GameState, LevelConfig, AnimationState, HistoryRecord, ScoreResult } from '@/types/game';
import { GameEngine } from '@/engine/GameEngine';
import { generateId } from '@/utils/math';

interface GameStore {
  currentPage: 'menu' | 'game' | 'result' | 'replay';
  selectedLevel: LevelConfig | null;
  gameEngine: GameEngine | null;
  gameState: GameState | null;
  animationState: AnimationState;
  sonarLog: string[];
  historyRecords: HistoryRecord[];
  replayState: {
    isReplaying: boolean;
    currentTurn: number;
    totalTurns: number;
    record: HistoryRecord | null;
    isPlaying: boolean;
  };
  renderOptions: {
    showTrajectories: boolean;
    showNoiseSources: boolean;
  };

  setCurrentPage: (page: 'menu' | 'game' | 'result' | 'replay') => void;
  selectLevel: (level: LevelConfig) => void;
  startGame: (level: LevelConfig) => void;
  endGame: () => void;
  restartGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  selectPosition: (x: number, y: number) => void;
  clearSelection: () => void;
  performScan: (type: 'active' | 'fan' | 'passive') => void;
  performAttack: () => void;
  endTurn: () => void;
  setAnimationState: (state: Partial<AnimationState>) => void;
  addLogMessages: (messages: string[]) => void;
  clearLog: () => void;
  setRenderOption: (key: 'showTrajectories' | 'showNoiseSources', value: boolean) => void;
  canPerformAction: (type: 'active' | 'fan' | 'passive' | 'attack') => { allowed: boolean; reason: string };
  saveHistoryRecord: (result: 'victory' | 'defeat', scoreResult: ScoreResult) => void;
  loadHistory: () => void;
  startReplay: (record: HistoryRecord) => void;
  setReplayTurn: (turn: number) => void;
  toggleReplayPlay: () => void;
  stopReplay: () => void;
  resetStore: () => void;
}

const HISTORY_KEY = 'sonar_game_history';
const MAX_HISTORY = 50;

export const useGameStore = create<GameStore>((set, get) => ({
  currentPage: 'menu',
  selectedLevel: null,
  gameEngine: null,
  gameState: null,
  animationState: {
    scanAnimation: null,
    attackAnimation: null,
    explosions: [],
  },
  sonarLog: [],
  historyRecords: [],
  replayState: {
    isReplaying: false,
    currentTurn: 0,
    totalTurns: 0,
    record: null,
    isPlaying: false,
  },
  renderOptions: {
    showTrajectories: false,
    showNoiseSources: true,
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  selectLevel: (level) => set({ selectedLevel: level }),

  startGame: (level) => {
    const engine = new GameEngine(level);
    const state = engine.getState();
    set({
      gameEngine: engine,
      gameState: state,
      selectedLevel: level,
      currentPage: 'game',
      sonarLog: [
        '=== 声呐系统启动 ===',
        `海域: ${level.name}`,
        `目标数量: ${level.targetCount}`,
        `初始能量: ${level.initialEnergy}`,
        '等待指令...',
      ],
      animationState: {
        scanAnimation: null,
        attackAnimation: null,
        explosions: [],
      },
    });
  },

  endGame: () => {
    const { gameEngine, gameState } = get();
    if (!gameEngine || !gameState) return;

    const scoreResult = gameEngine.getScoreResult();
    const result = gameState.gameStatus === 'victory' ? 'victory' : 'defeat';

    get().saveHistoryRecord(result, scoreResult);

    set({
      currentPage: 'result',
      gameState: { ...gameEngine.getState() },
    });
  },

  restartGame: () => {
    const { gameEngine, selectedLevel } = get();
    if (!gameEngine || !selectedLevel) return;

    const newState = gameEngine.restart();
    set({
      gameState: newState,
      animationState: {
        scanAnimation: null,
        attackAnimation: null,
        explosions: [],
      },
      sonarLog: [
        '=== 任务重启 ===',
        `海域: ${selectedLevel.name}`,
        `目标数量: ${selectedLevel.targetCount}`,
        `初始能量: ${selectedLevel.initialEnergy}`,
        '等待指令...',
      ],
    });
  },

  pauseGame: () => {
    const { gameEngine } = get();
    if (!gameEngine) return;
    gameEngine.pause();
    set({ gameState: { ...gameEngine.getState() } });
  },

  resumeGame: () => {
    const { gameEngine } = get();
    if (!gameEngine) return;
    gameEngine.resume();
    set({ gameState: { ...gameEngine.getState() } });
  },

  selectPosition: (x, y) => {
    const { gameEngine, gameState } = get();
    if (!gameEngine || !gameState || gameState.gameStatus !== 'playing') return;

    const gridSize = gameState.level.gridSize;
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;

    gameEngine.selectPosition({ x, y });
    set({ gameState: { ...gameEngine.getState() } });
  },

  clearSelection: () => {
    const { gameEngine } = get();
    if (!gameEngine) return;
    gameEngine.selectPosition(null);
    set({ gameState: { ...gameEngine.getState() } });
  },

  performScan: (type) => {
    const { gameEngine, gameState } = get();
    if (!gameEngine || !gameState) return;

    const check = gameEngine.canPerformAction(type);
    if (!check.allowed) {
      get().addLogMessages([`[错误] ${check.reason}`]);
      return;
    }

    const { echoes, logMessages } = gameEngine.performScan(type);

    const config = gameState.level.scanConfigs[type];
    const playerPos = gameEngine.getPlayerPosition();

    set({
      animationState: {
        ...get().animationState,
        scanAnimation: {
          active: true,
          center: playerPos,
          radius: 0,
          maxRadius: config.range,
          startTime: performance.now(),
          duration: 800,
          type,
        },
      },
    });

    setTimeout(() => {
      set({
        animationState: {
          ...get().animationState,
          scanAnimation: null,
        },
      });
    }, 800);

    get().addLogMessages(logMessages);
    set({ gameState: { ...gameEngine.getState() } });

    const newState = gameEngine.getState();
    if (newState.gameStatus === 'victory' || newState.gameStatus === 'defeat') {
      setTimeout(() => get().endGame(), 1000);
    }
  },

  performAttack: () => {
    const { gameEngine, gameState } = get();
    if (!gameEngine || !gameState) return;

    const check = gameEngine.canPerformAction('attack');
    if (!check.allowed) {
      get().addLogMessages([`[错误] ${check.reason}`]);
      return;
    }

    const { hit, result, logMessages } = gameEngine.performAttack();
    const targetPos = gameEngine.getState().selectedPosition!;

    set({
      animationState: {
        ...get().animationState,
        attackAnimation: {
          active: true,
          position: targetPos,
          startTime: performance.now(),
          duration: 1500,
          result,
        },
      },
    });

    if (hit) {
      set({
        animationState: {
          ...get().animationState,
          explosions: [
            ...get().animationState.explosions,
            {
              position: targetPos,
              startTime: performance.now() + 450,
              duration: 1000,
              radius: 2,
            },
          ],
        },
      });
    }

    setTimeout(() => {
      set((state) => ({
        animationState: {
          ...state.animationState,
          attackAnimation: null,
          explosions: state.animationState.explosions.filter(
            (e) => performance.now() - e.startTime < e.duration
          ),
        },
      }));
    }, 1500);

    get().addLogMessages(logMessages);
    set({ gameState: { ...gameEngine.getState() } });

    const newState = gameEngine.getState();
    if (newState.gameStatus === 'victory' || newState.gameStatus === 'defeat') {
      setTimeout(() => get().endGame(), 1500);
    }
  },

  endTurn: () => {
    const { gameEngine } = get();
    if (!gameEngine) return;

    const { logMessages, targetsMoved } = gameEngine.endTurn();
    get().addLogMessages(logMessages);
    get().addLogMessages([`[回合${gameEngine.getState().currentTurn}] ${targetsMoved}艘潜艇移动`]);

    set({
      gameState: { ...gameEngine.getState() },
      animationState: {
        ...get().animationState,
        explosions: get().animationState.explosions.filter(
          (e) => performance.now() - e.startTime < e.duration
        ),
      },
    });

    const newState = gameEngine.getState();
    if (newState.gameStatus === 'victory' || newState.gameStatus === 'defeat') {
      setTimeout(() => get().endGame(), 500);
    }
  },

  setAnimationState: (state) =>
    set((prev) => ({
      animationState: { ...prev.animationState, ...state },
    })),

  addLogMessages: (messages) =>
    set((state) => ({
      sonarLog: [...state.sonarLog, ...messages].slice(-200),
    })),

  clearLog: () => set({ sonarLog: [] }),

  setRenderOption: (key, value) =>
    set((state) => ({
      renderOptions: { ...state.renderOptions, [key]: value },
    })),

  canPerformAction: (type) => {
    const { gameEngine } = get();
    if (!gameEngine) {
      return { allowed: false, reason: '游戏引擎未初始化' };
    }
    return gameEngine.canPerformAction(type);
  },

  saveHistoryRecord: (result, scoreResult) => {
    const { gameState, selectedLevel, historyRecords } = get();
    if (!gameState || !selectedLevel) return;

    const duration = gameState.endTime
      ? (gameState.endTime - gameState.startTime) / 1000
      : 0;

    const record: HistoryRecord = {
      id: generateId(),
      levelId: selectedLevel.id,
      levelName: selectedLevel.name,
      difficulty: selectedLevel.difficulty,
      result,
      score: scoreResult.totalScore,
      turns: gameState.currentTurn,
      duration,
      energyRemaining: gameState.energy,
      targetsDestroyed: gameState.destroyedTargets,
      targetsTotal: gameState.targets.length,
      defeatReason: gameState.defeatReason,
      timestamp: Date.now(),
      gameStateSnapshot: JSON.parse(JSON.stringify(gameState)),
    };

    const newRecords = [record, ...historyRecords].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newRecords));
    set({ historyRecords: newRecords });
  },

  loadHistory: () => {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      if (data) {
        const records = JSON.parse(data);
        set({ historyRecords: records });
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  },

  startReplay: (record) => {
    set({
      currentPage: 'replay',
      replayState: {
        isReplaying: true,
        currentTurn: 0,
        totalTurns: record.gameStateSnapshot.turnHistory.length,
        record,
        isPlaying: false,
      },
      gameState: record.gameStateSnapshot.turnHistory[0] || record.gameStateSnapshot,
    });
  },

  setReplayTurn: (turn) => {
    const { replayState } = get();
    if (!replayState.record) return;

    const history = replayState.record.gameStateSnapshot.turnHistory;
    const targetState =
      turn < history.length
        ? history[turn]
        : replayState.record.gameStateSnapshot;

    set({
      replayState: { ...replayState, currentTurn: turn },
      gameState: targetState,
    });
  },

  toggleReplayPlay: () => {
    set((state) => ({
      replayState: {
        ...state.replayState,
        isPlaying: !state.replayState.isPlaying,
      },
    }));
  },

  stopReplay: () => {
    set({
      currentPage: 'menu',
      replayState: {
        isReplaying: false,
        currentTurn: 0,
        totalTurns: 0,
        record: null,
        isPlaying: false,
      },
      gameState: null,
    });
  },

  resetStore: () => {
    set({
      currentPage: 'menu',
      selectedLevel: null,
      gameEngine: null,
      gameState: null,
      animationState: {
        scanAnimation: null,
        attackAnimation: null,
        explosions: [],
      },
      sonarLog: [],
      replayState: {
        isReplaying: false,
        currentTurn: 0,
        totalTurns: 0,
        record: null,
        isPlaying: false,
      },
    });
  },
}));
