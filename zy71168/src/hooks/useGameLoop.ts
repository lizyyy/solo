import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

export const useGameLoop = () => {
  const status = useGameStore(state => state.status);
  const isPaused = useGameStore(state => state.isPaused);
  const updateTimer = useGameStore(state => state.updateTimer);
  const updateTemperature = useGameStore(state => state.updateTemperature);
  const timerRef = useRef<number | null>(null);
  const tempRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === 'playing' && !isPaused) {
      timerRef.current = window.setInterval(() => {
        updateTimer();
      }, 1000);

      tempRef.current = window.setInterval(() => {
        updateTemperature();
      }, 3000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (tempRef.current) {
        clearInterval(tempRef.current);
        tempRef.current = null;
      }
    };
  }, [status, isPaused, updateTimer, updateTemperature]);

  return null;
};
