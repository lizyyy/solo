import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

export function useKeyboardShortcuts() {
  const {
    gameState,
    currentPage,
    performScan,
    performAttack,
    endTurn,
    pauseGame,
    resumeGame,
    restartGame,
    setRenderOption,
    renderOptions,
    addLogMessages,
    canPerformAction,
  } = useGameStore();

  useEffect(() => {
    if (currentPage !== 'game') return;
    if (!gameState || gameState.gameStatus === 'victory' || gameState.gameStatus === 'defeat') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isPlaying = gameState.gameStatus === 'playing';
      const isPaused = gameState.gameStatus === 'paused';

      switch (e.key.toLowerCase()) {
        case '1':
          e.preventDefault();
          if (isPlaying) {
            const check = canPerformAction('active');
            if (check.allowed) {
              performScan('active');
            } else {
              addLogMessages([`[错误] ${check.reason}`]);
            }
          }
          break;

        case '2':
          e.preventDefault();
          if (isPlaying) {
            const check = canPerformAction('fan');
            if (check.allowed) {
              performScan('fan');
            } else {
              addLogMessages([`[错误] ${check.reason}`]);
            }
          }
          break;

        case '3':
          e.preventDefault();
          if (isPlaying) {
            const check = canPerformAction('passive');
            if (check.allowed) {
              performScan('passive');
            } else {
              addLogMessages([`[错误] ${check.reason}`]);
            }
          }
          break;

        case ' ':
          e.preventDefault();
          if (isPlaying) {
            const check = canPerformAction('attack');
            if (check.allowed) {
              performAttack();
            } else {
              addLogMessages([`[错误] ${check.reason}`]);
            }
          }
          break;

        case 'e':
          e.preventDefault();
          if (isPlaying) {
            endTurn();
          }
          break;

        case 'p':
          e.preventDefault();
          if (isPlaying) {
            pauseGame();
          } else if (isPaused) {
            resumeGame();
          }
          break;

        case 'r':
          e.preventDefault();
          if (window.confirm('确定要重新开始游戏吗？当前进度将丢失。')) {
            restartGame();
          }
          break;

        case 'n':
          e.preventDefault();
          setRenderOption('showNoiseSources', !renderOptions.showNoiseSources);
          break;

        case 't':
          e.preventDefault();
          setRenderOption('showTrajectories', !renderOptions.showTrajectories);
          break;

        case 'escape':
          e.preventDefault();
          if (isPlaying) {
            pauseGame();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    currentPage,
    performScan,
    performAttack,
    endTurn,
    pauseGame,
    resumeGame,
    restartGame,
    setRenderOption,
    renderOptions,
    addLogMessages,
    canPerformAction,
  ]);
}
