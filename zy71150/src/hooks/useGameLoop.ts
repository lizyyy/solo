import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

export const useGameLoop = () => {
  const incrementTime = useGameStore(state => state.incrementTime);
  const gameState = useGameStore(state => state.gameState);
  const isPaused = useGameStore(state => state.isPaused);
  const isReplayMode = useGameStore(state => state.isReplayMode);
  const intervalRef = useRef<number | null>(null);

  const startLoop = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    
    intervalRef.current = window.setInterval(() => {
      incrementTime();
    }, 1000);
  }, [incrementTime]);

  const stopLoop = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gameState?.status === 'playing' && !isPaused && !isReplayMode) {
      startLoop();
    } else {
      stopLoop();
    }

    return () => stopLoop();
  }, [gameState?.status, isPaused, isReplayMode, startLoop, stopLoop]);

  return { startLoop, stopLoop };
};
