import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';

export function useTimer() {
  const { gameState, handleTimeout } = useGameStore();
  const [remainingTime, setRemainingTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);

  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRemainingTime(gameState.level.timePerVehicle);
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
  }, [gameState.level.timePerVehicle]);

  useEffect(() => {
    if (gameState.status === 'playing' && gameState.currentVehicle) {
      resetTimer();
    }
  }, [gameState.currentVehicle?.id, gameState.status, resetTimer]);

  useEffect(() => {
    if (gameState.status !== 'playing') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - startTimeRef.current - pausedTimeRef.current) / 1000;
      const remaining = Math.max(0, gameState.level.timePerVehicle - elapsed);
      
      setRemainingTime(remaining);
      setElapsedTime(elapsed);

      if (remaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        handleTimeout();
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [gameState.status, gameState.level.timePerVehicle, gameState.currentVehicle?.id, handleTimeout]);

  useEffect(() => {
    if (gameState.status === 'paused') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else if (gameState.status === 'playing' && gameState.pauseTime > 0) {
      pausedTimeRef.current += Date.now() - gameState.pauseTime;
    }
  }, [gameState.status, gameState.pauseTime]);

  const timeProgress = gameState.level.timePerVehicle > 0 
    ? remainingTime / gameState.level.timePerVehicle 
    : 1;

  return {
    remainingTime,
    elapsedTime,
    timeProgress,
    resetTimer,
  };
}
