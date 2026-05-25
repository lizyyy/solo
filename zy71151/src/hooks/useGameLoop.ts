import { useEffect, useRef } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { useGameStore } from '../store/gameStore';

export const useGameLoop = () => {
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const animate = (currentTime: number) => {
      const state = useGameStore.getState().state;
      
      if (state && state.phase === 'playing') {
        const deltaTime = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0;
        const cappedDelta = Math.min(deltaTime, 0.1);
        
        const newState = GameEngine.update(state, cappedDelta);
        
        if (newState.phase === 'ended') {
        (window as any).lastSessionHistory = newState.history;
        (window as any).lastSessionState = newState;
        (window as any).lastGameState = newState;
      }
        
        useGameStore.setState({ state: newState });
      }
      
      lastTimeRef.current = currentTime;
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);
};
