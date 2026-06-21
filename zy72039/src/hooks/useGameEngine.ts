import { useReducer, useEffect, useCallback } from 'react';
import type { GameState, GameAction, GameConfig } from '../types';
import { createInitialState, gameReducer, calculateGameStats } from '../engine/gameStateMachine';
import { saveState, loadState } from '../services/storageService';
import { validateConfig } from '../utils/configValidator';

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const saved = loadState();
    return saved || createInitialState();
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  const startGame = useCallback((config: GameConfig) => {
    const validation = validateConfig(config);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors, warnings: validation.warnings };
    }
    dispatch({ type: 'START', payload: { config } });
    return { success: true, errors: [], warnings: validation.warnings };
  }, []);

  const pauseGame = useCallback((note: string = '') => {
    dispatch({ type: 'PAUSE', payload: { note } });
  }, []);

  const resumeGame = useCallback(() => {
    dispatch({ type: 'RESUME' });
  }, []);

  const submitInput = useCallback((value: string | number, note: string = '', source?: 'manual' | 'import' | 'test', responseTime?: number) => {
    dispatch({ type: 'INPUT', payload: { value, note, source, responseTime } });
  }, []);

  const restartGame = useCallback(() => {
    dispatch({ type: 'RESTART' });
  }, []);

  const endGame = useCallback(() => {
    dispatch({ type: 'END' });
  }, []);

  const startPlayback = useCallback(() => {
    dispatch({ type: 'PLAYBACK_START' });
  }, []);

  const playbackNext = useCallback(() => {
    dispatch({ type: 'PLAYBACK_NEXT' });
  }, []);

  const playbackPrev = useCallback(() => {
    dispatch({ type: 'PLAYBACK_PREV' });
  }, []);

  const playbackGoto = useCallback((index: number) => {
    dispatch({ type: 'PLAYBACK_GOTO', payload: { index } });
  }, []);

  const stopPlayback = useCallback(() => {
    dispatch({ type: 'PLAYBACK_STOP' });
  }, []);

  const stats = calculateGameStats(state);

  return {
    state,
    dispatch,
    stats,
    actions: {
      startGame,
      pauseGame,
      resumeGame,
      submitInput,
      restartGame,
      endGame,
      startPlayback,
      playbackNext,
      playbackPrev,
      playbackGoto,
      stopPlayback,
    },
  };
}
