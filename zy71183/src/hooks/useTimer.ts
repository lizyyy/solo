import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { createScoreDetail } from '../utils/scoreCalculator';

export function useTimer(_initialTime: number, onTimeout: () => void) {
  const gameState = useGameStore();
  const hasTriggeredTimeout = useRef(false);

  const tick = useCallback(() => {
    if (gameState.isPaused || gameState.isCompleted || !gameState.isStarted) return;

    const newTime = gameState.timeRemaining - 1;
    gameState.setTimeRemaining(newTime);

    if (newTime < 0) {
      gameState.addScoreDetail(
        createScoreDetail('timeout', `超时 ${Math.abs(newTime)} 秒`)
      );
      
      if (!hasTriggeredTimeout.current) {
        hasTriggeredTimeout.current = true;
        onTimeout();
      }
    }
  }, [gameState, onTimeout]);

  useEffect(() => {
    hasTriggeredTimeout.current = false;
  }, [gameState.isStarted]);

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
    isTimeout: gameState.timeRemaining < 0,
  };
}
