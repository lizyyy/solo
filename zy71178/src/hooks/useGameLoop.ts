import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

export function useGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const isPlaying = useGameStore((state) => state.isPlaying);
  const isPaused = useGameStore((state) => state.isPaused);
  const tick = useGameStore((state) => state.tick);

  useEffect(() => {
    if (!isPlaying || isPaused) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const gameLoop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      const clampedDelta = Math.min(deltaTime, 0.1);
      tick(clampedDelta);

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isPaused, tick]);
}
