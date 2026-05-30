import { create } from 'zustand';
import type { Game, RatingAction, GameMode, GameReport, RatingLevel, BondHolding } from '@/types';
import { GameEngine } from '@/engine/gameEngine';
import { GAME_CONFIG } from '@/data/constants';

interface GameStore {
  game: Game | null;
  selectedBond: string | null;
  isTimerRunning: boolean;
  timeLeft: number;

  initializeGame: (mode: string) => void;
  submitRating: (action: RatingAction) => { roundScore: number; anomalies: any[] } | null;
  nextRound: () => void;
  finishGame: () => void;
  saveGame: (game: Game) => void;
  setSelectedBond: (bondCode: string | null) => void;
  getSavedGames: () => { gameId: string; game: Game; savedAt: number }[];
  getSavedGame: (gameId: string) => Game | null;
  deleteSavedGame: (gameId: string) => void;
  updateTimer: (time: number) => void;
  setTimerRunning: (running: boolean) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedBond: null,
  isTimerRunning: false,
  timeLeft: 60,

  initializeGame: (mode: string) => {
    const game = GameEngine.initializeGame(mode as GameMode);
    const timeLimit = mode === 'tutorial' ? GAME_CONFIG.tutorialTimeLimit : GAME_CONFIG.standardTimeLimit;
    set({ game, selectedBond: null, timeLeft: timeLimit, isTimerRunning: false });
  },

  updateTimer: (time: number) => {
    set({ timeLeft: time });
  },

  setTimerRunning: (running: boolean) => {
    set({ isTimerRunning: running });
  },

  submitRating: (action: RatingAction) => {
    const { game } = get();
    if (!game) return null;

    const result = GameEngine.submitRating(game, action);
    if (result) {
      set({ game: result.game });
      return {
        roundScore: result.roundScore,
        anomalies: result.anomalies,
      };
    }
    return null;
  },

  nextRound: () => {
    const { game } = get();
    if (!game) return;

    const updatedGame = GameEngine.nextRound(game);
    set({ game: updatedGame, selectedBond: null });
  },

  finishGame: () => {
    const { game } = get();
    if (!game) return;

    const finishedGame = GameEngine.finishGame(game);
    set({ game: finishedGame });
  },

  saveGame: (game: Game) => {
    GameEngine.saveToStorage(game);
  },

  setSelectedBond: (bondCode: string | null) => {
    set({ selectedBond: bondCode });
  },

  getSavedGames: () => {
    return GameEngine.getSavedGames();
  },

  getSavedGame: (gameId: string) => {
    return GameEngine.loadFromStorage(gameId);
  },

  deleteSavedGame: (gameId: string) => {
    GameEngine.deleteFromStorage(gameId);
  },
}));
