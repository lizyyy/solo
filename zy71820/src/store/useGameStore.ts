import { create } from 'zustand';
import type { GameState, LevelConfig, GameSaveState } from '../types/game';
import type { PlayerScore } from '../types/data';

interface GameStore {
  levelConfig: LevelConfig | null;
  gameState: GameState | null;
  lastScore: PlayerScore | null;
  isGameActive: boolean;
  showResumeDialog: boolean;
  savedGame: GameSaveState | null;
  playerName: string;

  setLevelConfig: (config: LevelConfig) => void;
  setGameState: (state: GameState) => void;
  setLastScore: (score: PlayerScore | null) => void;
  setIsGameActive: (active: boolean) => void;
  setShowResumeDialog: (show: boolean) => void;
  setSavedGame: (save: GameSaveState | null) => void;
  setPlayerName: (name: string) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  levelConfig: null,
  gameState: null,
  lastScore: null,
  isGameActive: false,
  showResumeDialog: false,
  savedGame: null,
  playerName: '玩家',

  setLevelConfig: (config) => set({ levelConfig: config }),
  setGameState: (state) => set({ gameState: state }),
  setLastScore: (score) => set({ lastScore: score }),
  setIsGameActive: (active) => set({ isGameActive: active }),
  setShowResumeDialog: (show) => set({ showResumeDialog: show }),
  setSavedGame: (save) => set({ savedGame: save }),
  setPlayerName: (name) => set({ playerName: name }),
  resetGame: () => set({
    gameState: null,
    isGameActive: false,
    lastScore: null,
  }),
}));
