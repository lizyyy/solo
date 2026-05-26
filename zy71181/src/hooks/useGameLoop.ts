import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';

export const useGameLoop = () => {
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  const gameLoop = useCallback((timestamp: number) => {
    if (!isPlayingRef.current) return;

    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    const { gameState, updateGame } = useGameStore.getState();

    if (gameState.status === 'playing') {
      updateGame(deltaTime);
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startLoop = useCallback(() => {
    isPlayingRef.current = true;
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  const stopLoop = useCallback(() => {
    isPlayingRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  return { startLoop, stopLoop };
};
