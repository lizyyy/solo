import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

export function useGameLoop() {
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const phaseRef = useRef<string>('menu');

  useEffect(() => {
    const updatePhase = () => {
      phaseRef.current = useGameStore.getState().phase;
    };

    const unsubscribe = useGameStore.subscribe((state) => {
      phaseRef.current = state.phase;
    });

    const gameLoop = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      if (phaseRef.current === 'playing') {
        useGameStore.getState().tick(deltaTime);
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    updatePhase();
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      unsubscribe();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
}