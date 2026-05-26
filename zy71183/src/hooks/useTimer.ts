import { useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { createScoreDetail } from '../utils/scoreCalculator';

export function useTimer(initialTime: number, onTimeout: () => void) {
  const gameState = useGameStore();

  const tick = useCallback(() => {
    if (gameState.isPaused || gameState.isCompleted || !gameState.isStarted) return;

    const newTime = gameState.timeRemaining - 1;
    gameState.setTimeRemaining(newTime);

    if (newTime <= 0) {
      const overTime = Math.abs(newTime);
      if (overTime > 0) {
        gameState.addScoreDetail(
          createScoreDetail('timeout', `超时 ${overTime} 秒`)
        );
      }
      onTimeout();
    }
  }, [gameState, onTimeout]);

  useEffect(() => {
    if (!gameState.isStarted || gameState.isPaused || gameState.isCompleted) return;

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tick, gameState.isStarted, gameState.isPaused, gameState.isCompleted]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const prefix = seconds < 0 ? '-' : '';
    return `${prefix}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeRemaining: gameState.timeRemaining,
    formatTime,
    isTimeout: gameState.timeRemaining <= 0,
  };
}
