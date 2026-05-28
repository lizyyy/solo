import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

export function useGameEngine() {
  const { state, tick, finalizeGame } = useGameStore();
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const hasFinalizedRef = useRef(false);
  const lastGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.id !== lastGameIdRef.current) {
      lastGameIdRef.current = state.id;
      hasFinalizedRef.current = false;
    }
  }, [state.id]);

  useEffect(() => {
    if (state.isGameOver && !hasFinalizedRef.current) {
      hasFinalizedRef.current = true;
      finalizeGame();
    }
  }, [state.isGameOver, finalizeGame]);

  useEffect(() => {
    if (state.isPaused || state.isGameOver) {
      return;
    }

    lastTimeRef.current = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      tick(deltaTime);

      const { state: currentState } = useGameStore.getState();
      if (!currentState.isPaused && !currentState.isGameOver) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isPaused, state.isGameOver, tick]);

  return null;
}
