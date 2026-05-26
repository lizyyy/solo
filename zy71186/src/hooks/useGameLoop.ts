import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GAME_CONFIG } from '../engine/constants';

export function useGameLoop() {
  const { gameStatus, gameSpeed, gameTick } = useGameStore();
  const lastTickRef = useRef<number>(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (gameStatus !== 'playing') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const tickInterval = GAME_CONFIG.tickRate / gameSpeed;

    const loop = (timestamp: number) => {
      if (timestamp - lastTickRef.current >= tickInterval) {
        gameTick();
        lastTickRef.current = timestamp;
      }
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameStatus, gameSpeed, gameTick]);
}
