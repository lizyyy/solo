import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';

export const useGameLoop = () => {
  const { status, updateTime, addPassengers, updateTrains } = useGameStore();
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  const gameLoop = useCallback((timestamp: number) => {
    const state = useGameStore.getState();
    
    if (state.status !== 'playing') {
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current - pausedTimeRef.current;
    const deltaTime = elapsed - lastTimeRef.current;

    if (deltaTime > 0) {
      updateTime(elapsed);
      addPassengers(deltaTime);
      updateTrains(elapsed);
    }

    lastTimeRef.current = elapsed;
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [updateTime, addPassengers, updateTrains]);

  useEffect(() => {
    if (status === 'playing') {
      if (pausedAtRef.current) {
        pausedTimeRef.current += performance.now() - pausedAtRef.current;
        pausedAtRef.current = 0;
      }
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    } else if (status === 'paused') {
      pausedAtRef.current = performance.now();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else if (status === 'ended' || status === 'idle') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      startTimeRef.current = 0;
      lastTimeRef.current = 0;
      pausedTimeRef.current = 0;
      pausedAtRef.current = 0;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [status, gameLoop]);

  const reset = useCallback(() => {
    startTimeRef.current = 0;
    lastTimeRef.current = 0;
    pausedTimeRef.current = 0;
    pausedAtRef.current = 0;
  }, []);

  return { reset };
};
