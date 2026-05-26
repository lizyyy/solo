import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';

export function useKeyboardControls() {
  const { gameState, passVehicle, interceptVehicle, pauseGame, resumeGame, restartGame } = useGameStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.status !== 'playing' && gameState.status !== 'paused') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'enter':
          e.preventDefault();
          if (gameState.status === 'playing') {
            passVehicle();
          }
          break;
        case 'escape':
          e.preventDefault();
          if (gameState.status === 'playing') {
            pauseGame();
          } else if (gameState.status === 'paused') {
            resumeGame();
          }
          break;
        case 'backspace':
        case 'delete':
          e.preventDefault();
          if (gameState.status === 'playing') {
            interceptVehicle();
          }
          break;
        case 'r':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            restartGame();
          }
          break;
        case 'p':
          e.preventDefault();
          if (gameState.status === 'playing') {
            pauseGame();
          } else if (gameState.status === 'paused') {
            resumeGame();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status, passVehicle, interceptVehicle, pauseGame, resumeGame, restartGame]);
}
