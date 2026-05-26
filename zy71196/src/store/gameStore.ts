import { create } from 'zustand';
import type { GameState, ToolType, LevelConfig } from '../game/types';
import { createInitialState, useTool, endRound, togglePause, restartGame } from '../game/engine';
import { saveGameRecord } from '../game/replay';
import { LEVELS } from '../game/config';

interface GameStore {
  state: GameState | null;
  currentLevelId: number | null;
  message: string | null;
  showMessage: (message: string) => void;
  clearMessage: () => void;
  startGame: (levelId: number) => void;
  selectTool: (tool: ToolType) => void;
  useTool: (targetId: string, targetType: 'drain' | 'lowarea') => void;
  endCurrentRound: () => void;
  togglePauseGame: () => void;
  restartCurrentGame: () => void;
  exitToMenu: () => void;
  saveRecord: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  currentLevelId: null,
  message: null,

  showMessage: (message: string) => {
    set({ message });
    setTimeout(() => set({ message: null }), 3000);
  },

  clearMessage: () => set({ message: null }),

  startGame: (levelId: number) => {
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level) return;

    const initialState = createInitialState(level);
    set({
      state: initialState,
      currentLevelId: levelId,
      message: null,
    });
  },

  selectTool: (tool: ToolType) => {
    const { state } = get();
    if (!state || state.phase !== 'playing') return;
    set({ state: { ...state, selectedTool: tool } });
  },

  useTool: (targetId: string, targetType: 'drain' | 'lowarea') => {
    const { state, showMessage } = get();
    if (!state || state.phase !== 'playing' || state.isPaused) return;

    const { newState, success, message } = useTool(state, state.selectedTool, targetId, targetType);
    
    if (success) {
      set({ state: newState });
    }
    showMessage(message);
  },

  endCurrentRound: () => {
    const { state, showMessage } = get();
    if (!state || state.phase !== 'playing' || state.isPaused) return;

    const { newState, newLeaks, gameEnded } = endRound(state);
    
    if (newLeaks.length > 0) {
      showMessage(`警告：发现 ${newLeaks.length} 处漏水！`);
    } else if (!gameEnded) {
      showMessage(`回合 ${state.currentRound} 结束，进入下一回合`);
    }

    set({ state: newState });

    if (gameEnded) {
      setTimeout(() => {
        const currentState = get().state;
        if (currentState) {
          saveGameRecord(currentState);
        }
      }, 100);
    }
  },

  togglePauseGame: () => {
    const { state } = get();
    if (!state) return;
    set({ state: togglePause(state) });
  },

  restartCurrentGame: () => {
    const { currentLevelId } = get();
    if (currentLevelId === null) return;
    
    const level = LEVELS.find((l) => l.id === currentLevelId);
    if (!level) return;

    const newState = restartGame(level);
    set({ state: newState, message: null });
  },

  exitToMenu: () => {
    set({ state: null, currentLevelId: null, message: null });
  },

  saveRecord: () => {
    const { state } = get();
    if (state && state.phase === 'result') {
      saveGameRecord(state);
    }
  },
}));
