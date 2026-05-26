import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';

export const useGameLoop = () => {
  const status = useGameStore(state => state.status);
  const updateGame = useGameStore(state => state.updateGame);
  const spawnBaggage = useGameStore(state => state.spawnBaggage);
  const updateReplay = useGameStore(state => state.updateReplay);
  
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (status !== 'playing' && status !== 'replay') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const loop = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = currentTime;

      if (status === 'playing') {
        updateGame(deltaTime);
        spawnBaggage();
      } else if (status === 'replay') {
        updateReplay(deltaTime);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [status, updateGame, spawnBaggage, updateReplay]);
};
