import { create } from 'zustand';
import { GameState, GameItem, LevelConfig, WasteCategory, WasteItem, ErrorRecord, GameResult } from '../types';
import { RECYCLABLE_ITEMS, HAZARDOUS_ITEMS, KITCHEN_ITEMS, OTHER_ITEMS } from '../data/items';

const getItemsForCategory = (category: WasteCategory): WasteItem[] => {
  switch (category) {
    case 'recyclable': return RECYCLABLE_ITEMS;
    case 'hazardous': return HAZARDOUS_ITEMS;
    case 'kitchen': return KITCHEN_ITEMS;
    case 'other': return OTHER_ITEMS;
  }
};

const generateRandomItem = (level: LevelConfig): WasteItem => {
  const randomCategory = level.itemTypes[Math.floor(Math.random() * level.itemTypes.length)];
  const items = getItemsForCategory(randomCategory);
  const randomItem = items[Math.floor(Math.random() * items.length)];
  
  const isPolluted = randomItem.isPolluted || Math.random() < level.pollutionRate;
  const isDangerous = randomItem.isDangerous || Math.random() < level.dangerRate;
  
  return {
    ...randomItem,
    isPolluted,
    isDangerous: randomItem.category === 'hazardous' ? true : isDangerous,
  };
};

interface GameStore extends GameState {
  startGame: (level: LevelConfig) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  resetGame: () => void;
  spawnItem: () => void;
  updateItems: (deltaTime: number, conveyorWidth: number) => void;
  setItemDragging: (instanceId: string, isDragging: boolean, x?: number, y?: number) => void;
  sortItem: (instanceId: string, targetCategory: WasteCategory) => boolean;
  removeItem: (instanceId: string) => void;
  getResult: () => GameResult | null;
  setHighScore: (levelId: number, score: number) => void;
  getHighScore: (levelId: number) => number;
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  currentLevel: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  correctCount: 0,
  wrongCount: 0,
  missedCount: 0,
  items: [],
  errors: [],
  spawnedCount: 0,
  startTime: null,

  startGame: (level: LevelConfig) => {
    set({
      status: 'playing',
      currentLevel: level,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correctCount: 0,
      wrongCount: 0,
      missedCount: 0,
      items: [],
      errors: [],
      spawnedCount: 0,
      startTime: Date.now(),
    });
  },

  pauseGame: () => {
    set({ status: 'paused' });
  },

  resumeGame: () => {
    set({ status: 'playing' });
  },

  endGame: () => {
    set({ status: 'ended' });
  },

  resetGame: () => {
    set({
      status: 'idle',
      currentLevel: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correctCount: 0,
      wrongCount: 0,
      missedCount: 0,
      items: [],
      errors: [],
      spawnedCount: 0,
      startTime: null,
    });
  },

  spawnItem: () => {
    const state = get();
    if (!state.currentLevel || state.spawnedCount >= state.currentLevel.itemCount) return;

    const wasteItem = generateRandomItem(state.currentLevel);
    const gameItem: GameItem = {
      ...wasteItem,
      instanceId: `${wasteItem.id}-${Date.now()}-${Math.random()}`,
      x: -60,
      y: 0,
      isDragging: false,
      isSorted: false,
    };

    set(state => ({
      items: [...state.items, gameItem],
      spawnedCount: state.spawnedCount + 1,
    }));
  },

  updateItems: (deltaTime: number, conveyorWidth: number) => {
    const state = get();
    if (!state.currentLevel || state.status !== 'playing') return;

    const speed = state.currentLevel.speed * 60;
    const newErrors: ErrorRecord[] = [];
    const itemsToRemove: string[] = [];

    state.items.forEach(item => {
      if (item.isDragging || item.isSorted) return;

      const newX = item.x + speed * deltaTime;

      if (newX > conveyorWidth + 60) {
        itemsToRemove.push(item.instanceId);
        newErrors.push({
          id: `error-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          item: item,
          wrongCategory: null,
          correctCategory: item.category,
          type: item.isDangerous ? 'danger_missed' : 'missed',
        });
      }
    });

    if (itemsToRemove.length > 0 || newErrors.length > 0) {
      set(state => ({
        items: state.items
          .filter(item => !itemsToRemove.includes(item.instanceId))
          .map(item => 
            item.isDragging || item.isSorted 
              ? item 
              : { ...item, x: item.x + speed * deltaTime }
          ),
        missedCount: state.missedCount + itemsToRemove.length,
        errors: [...state.errors, ...newErrors],
        combo: newErrors.length > 0 ? 0 : state.combo,
      }));
    } else {
      set(state => ({
        items: state.items.map(item => 
          item.isDragging || item.isSorted 
            ? item 
            : { ...item, x: item.x + speed * deltaTime }
        ),
      }));
    }
  },

  setItemDragging: (instanceId: string, isDragging: boolean, x?: number, y?: number) => {
    set(state => ({
      items: state.items.map(item => 
        item.instanceId === instanceId 
          ? { ...item, isDragging, x: x ?? item.x, y: y ?? item.y }
          : item
      ),
    }));
  },

  sortItem: (instanceId: string, targetCategory: WasteCategory): boolean => {
    const state = get();
    const item = state.items.find(i => i.instanceId === instanceId);
    if (!item) return false;

    const isCorrect = item.category === targetCategory;
    const basePoints = item.points;
    const comboBonus = Math.floor(state.combo * 0.1 * basePoints);

    if (isCorrect) {
      const newCombo = state.combo + 1;
      set(state => ({
        score: state.score + basePoints + comboBonus,
        combo: newCombo,
        maxCombo: Math.max(state.maxCombo, newCombo),
        correctCount: state.correctCount + 1,
        items: state.items.filter(i => i.instanceId !== instanceId),
      }));
      return true;
    } else {
      const penalty = Math.floor(basePoints * 1.5);
      const dangerPenalty = item.isDangerous ? Math.floor(basePoints * 3) : 0;
      const totalPenalty = penalty + dangerPenalty;

      const errorRecord: ErrorRecord = {
        id: `error-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        item: item,
        wrongCategory: targetCategory,
        correctCategory: item.category,
        type: 'misclassified',
      };

      set(state => ({
        score: Math.max(0, state.score - totalPenalty),
        combo: 0,
        wrongCount: state.wrongCount + 1,
        items: state.items.filter(i => i.instanceId !== instanceId),
        errors: [...state.errors, errorRecord],
      }));
      return false;
    }
  },

  removeItem: (instanceId: string) => {
    set(state => ({
      items: state.items.filter(i => i.instanceId !== instanceId),
    }));
  },

  getResult: (): GameResult | null => {
    const state = get();
    if (!state.currentLevel || !state.startTime) return null;

    const totalAttempts = state.correctCount + state.wrongCount + state.missedCount;
    const accuracy = totalAttempts > 0 ? state.correctCount / totalAttempts : 0;

    return {
      level: state.currentLevel,
      score: state.score,
      accuracy,
      maxCombo: state.maxCombo,
      correctCount: state.correctCount,
      wrongCount: state.wrongCount,
      missedCount: state.missedCount,
      errors: state.errors,
      duration: Math.floor((Date.now() - state.startTime) / 1000),
    };
  },

  setHighScore: (levelId: number, score: number) => {
    try {
      const key = `recycling-game-highscore-${levelId}`;
      localStorage.setItem(key, score.toString());
    } catch (e) {
      console.error('Failed to save high score:', e);
    }
  },

  getHighScore: (levelId: number): number => {
    try {
      const key = `recycling-game-highscore-${levelId}`;
      const score = localStorage.getItem(key);
      return score ? parseInt(score, 10) : 0;
    } catch (e) {
      return 0;
    }
  },
}));
