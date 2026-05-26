import { useEffect, useRef } from 'react';
import { gameTick } from '../game/engine';
import { useGameStore } from '../game/state';

export function useGameLoop(tickInterval: number = 1000) {
  const intervalRef = useRef<number | null>(null);
  const status = useGameStore((state) => state.status);

  useEffect(() => {
    if (status === 'playing') {
      intervalRef.current = window.setInterval(() => {
        gameTick();
      }, tickInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, tickInterval]);

  return {
    isRunning: status === 'playing',
  };
}
