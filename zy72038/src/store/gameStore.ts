import { create } from 'zustand';
import {
  GameState,
  GameConfig,
  Tower,
  Enemy,
  ActionRecord,
  TowerType,
  AnalysisReport,
} from '@/types/game';
import { generateId } from '@/utils/gameUtils';

interface GameStore extends GameState {
  config: GameConfig | null;
  report: AnalysisReport | null;
  selectedTowerType: TowerType | null;
  lastActionTime: number | null;

  setConfig: (config: GameConfig | null) => void;
  setSelectedTowerType: (type: TowerType | null) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  endGame: () => void;
  startReplay: () => void;
  setReplayTime: (time: number) => void;
  setReplaySpeed: (speed: number) => void;

  addTower: (tower: Omit<Tower, 'id'>) => void;
  removeTower: (towerId: string) => void;
  updateTower: (towerId: string, updates: Partial<Tower>) => void;

  addEnemy: (enemy: Omit<Enemy, 'id'>) => void;
  removeEnemy: (enemyId: string) => void;
  updateEnemy: (enemyId: string, updates: Partial<Enemy>) => void;
  clearEnemies: () => void;

  addCoins: (amount: number) => void;
  takeDamage: (amount: number) => void;
  nextWave: () => void;

  recordAction: (action: Omit<ActionRecord, 'id' | 'timestamp'>) => void;
  setReport: (report: AnalysisReport | null) => void;
  updatePlayTime: () => void;
}

const initialState: GameState = {
  status: 'idle',
  currentLevel: 0,
  currentWave: 0,
  health: 100,
  maxHealth: 100,
  coins: 500,
  maxCoins: 1000,
  towers: [],
  enemies: [],
  totalPlayTime: 0,
  actions: [],
  events: [],
  replaySpeed: 1,
  replayTime: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  config: null,
  report: null,
  selectedTowerType: null,
  lastActionTime: null,

  setConfig: (config) => set({ config }),

  setSelectedTowerType: (type) => set({ selectedTowerType: type }),

  startGame: () => {
    const { config } = get();
    if (!config) return;

    set({
      status: 'playing',
      startTime: Date.now(),
      currentLevel: 0,
      currentWave: 1,
      health: config.resources.startHealth,
      maxHealth: config.resources.maxHealth,
      coins: config.resources.startCoins,
      maxCoins: config.resources.maxCoins,
      towers: [],
      enemies: [],
      totalPlayTime: 0,
      actions: [],
      lastActionTime: Date.now(),
    });
  },

  pauseGame: () => {
    const { status, startTime } = get();
    if (status !== 'playing') return;

    set({
      status: 'paused',
      pauseTime: Date.now(),
      totalPlayTime: startTime ? Date.now() - startTime : 0,
    });
  },

  resumeGame: () => {
    const { status } = get();
    if (status !== 'paused') return;

    set({
      status: 'playing',
      startTime: Date.now(),
      pauseTime: undefined,
    });
  },

  resetGame: () => {
    set({
      ...initialState,
      config: get().config,
    });
  },

  endGame: () => set({ status: 'ended' }),

  startReplay: () => set({ status: 'replaying', replayTime: 0 }),

  setReplayTime: (time) => set({ replayTime: time }),

  setReplaySpeed: (speed) => set({ replaySpeed: speed }),

  addTower: (tower) => {
    const newTower: Tower = {
      ...tower,
      id: generateId(),
    };
    set((state) => ({
      towers: [...state.towers, newTower],
      coins: state.coins - tower.cost,
    }));
  },

  removeTower: (towerId) => {
    set((state) => ({
      towers: state.towers.filter((t) => t.id !== towerId),
    }));
  },

  updateTower: (towerId, updates) => {
    set((state) => ({
      towers: state.towers.map((t) =>
        t.id === towerId ? { ...t, ...updates } : t
      ),
    }));
  },

  addEnemy: (enemy) => {
    const newEnemy: Enemy = {
      ...enemy,
      id: generateId(),
    };
    set((state) => ({
      enemies: [...state.enemies, newEnemy],
    }));
  },

  removeEnemy: (enemyId) => {
    set((state) => ({
      enemies: state.enemies.filter((e) => e.id !== enemyId),
    }));
  },

  updateEnemy: (enemyId, updates) => {
    set((state) => ({
      enemies: state.enemies.map((e) =>
        e.id === enemyId ? { ...e, ...updates } : e
      ),
    }));
  },

  clearEnemies: () => set({ enemies: [] }),

  addCoins: (amount) => {
    set((state) => ({
      coins: Math.min(state.maxCoins, state.coins + amount),
    }));
  },

  takeDamage: (amount) => {
    set((state) => ({
      health: Math.max(0, state.health - amount),
    }));
  },

  nextWave: () => {
    set((state) => ({
      currentWave: state.currentWave + 1,
    }));
  },

  recordAction: (action) => {
    const { lastActionTime } = get();
    const now = Date.now();
    const responseTime = lastActionTime ? now - lastActionTime : undefined;

    const newAction: ActionRecord = {
      ...action,
      id: generateId(),
      timestamp: now,
      responseTime,
    };

    set((state) => ({
      actions: [...state.actions, newAction],
      lastActionTime: now,
    }));
  },

  setReport: (report) => set({ report }),

  updatePlayTime: () => {
    const { status, startTime } = get();
    if (status === 'playing' && startTime) {
      set({
        totalPlayTime: Date.now() - startTime,
      });
    }
  },
}));
