import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';

export function useGameLoop() {
  const gameStatus = useGameStore((state) => state.gameStatus);
  const updateElapsedTime = useGameStore((state) => state.updateElapsedTime);
  const elapsedTimeRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const tick = useCallback(
    (timestamp: number) => {
      if (lastTickRef.current !== null && gameStatus === 'playing') {
        const delta = (timestamp - lastTickRef.current) / 1000;
        elapsedTimeRef.current += delta;
        updateElapsedTime(elapsedTimeRef.current);
      }
      lastTickRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [gameStatus, updateElapsedTime]
  );

  useEffect(() => {
    if (gameStatus === 'playing') {
      if (lastTickRef.current === null) {
        lastTickRef.current = performance.now();
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [gameStatus, tick]);

  const resetTime = useCallback(() => {
    elapsedTimeRef.current = 0;
    lastTickRef.current = null;
  }, []);

  return { resetTime };
}
