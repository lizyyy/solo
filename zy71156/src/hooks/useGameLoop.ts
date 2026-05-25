import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

export function useGameLoop() {
  const { status, tick, history, replayIndex, replaySpeed, setReplayIndex, elevators, teams, score, gameTime } = useGameStore();
  const lastTimeRef = useRef<number>(0);
  const animationRef = useRef<number>(0);
  const replayTimerRef = useRef<number>(0);

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
    } else if (status === 'replaying') {
      const replayLoop = () => {
        replayTimerRef.current = window.setInterval(() => {
          const state = useGameStore.getState();
          if (state.replayIndex < state.history.length - 1) {
            const nextIndex = Math.min(
              state.replayIndex + state.replaySpeed,
              state.history.length - 1
            );
            const frame = state.history[Math.floor(nextIndex)];
            if (frame) {
              useGameStore.setState({
                replayIndex: nextIndex,
                elevators: frame.elevators,
                teams: frame.teams,
                score: frame.score,
                gameTime: frame.gameTime,
              });
            }
          } else {
            clearInterval(replayTimerRef.current);
          }
        }, 16);
      };

      replayLoop();

      return () => {
        if (replayTimerRef.current) {
          clearInterval(replayTimerRef.current);
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
