import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

export function useGameLoop() {
  const { status, tick, history, replayIndex, replaySpeed, setReplayIndex, elevators, teams, score, gameTime } = useGameStore();
  const lastTimeRef = useRef<number>(0);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (status === 'playing') {
      const gameLoop = (timestamp: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const deltaTime = (timestamp - lastTimeRef.current) / 1000;
        lastTimeRef.current = timestamp;

        tick(deltaTime);
        animationRef.current = requestAnimationFrame(gameLoop);
      };

      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(gameLoop);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [status, tick]);

  return {
    elevators,
    teams,
    score,
    gameTime,
    history,
    replayIndex,
    replaySpeed,
    setReplayIndex,
  };
}
