
import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/useGameStore';

export const useGameTimer = () => {
  const { status, timeRemaining, levelConfig, setTimeRemaining, setElapsedTime, endGame } = useGameStore();
  const intervalRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (status !== 'playing') return;

    const newTimeRemaining = timeRemaining - 1;
    const newElapsedTime = (levelConfig?.timeLimit || 0) - newTimeRemaining;

    setTimeRemaining(newTimeRemaining);
    setElapsedTime(newElapsedTime);

    if (newTimeRemaining <= 0) {
      endGame();
    }
  }, [status, timeRemaining, levelConfig, setTimeRemaining, setElapsedTime, endGame]);

  useEffect(() => {
    if (status === 'playing') {
      intervalRef.current = window.setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, tick]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    formattedTime: formatTime(timeRemaining),
    timeRemaining,
    formatTime,
  };
};

export default useGameTimer;
