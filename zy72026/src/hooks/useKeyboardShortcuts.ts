import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { levels } from '../data/levels';

export function useKeyboardShortcuts() {
  const { session, makeChoice, startSession, pauseSession, resumeSession, restartSession, currentLevelId } = useGameStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const level = levels.find((l) => l.id === currentLevelId);
      const currentProblem = level?.problems[session?.currentProblemIndex ?? 0];

      if (session?.status === 'idle' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        startSession();
        return;
      }

      if (session?.status === 'running' && e.key === ' ') {
        e.preventDefault();
        pauseSession();
        return;
      }

      if (session?.status === 'paused' && e.key === ' ') {
        e.preventDefault();
        resumeSession();
        return;
      }

      if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        restartSession();
        return;
      }

      if (session?.status === 'running' && currentProblem) {
        const keyNum = parseInt(e.key, 10);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= currentProblem.options.length) {
          e.preventDefault();
          const option = currentProblem.options[keyNum - 1];
          if (option) {
            makeChoice(option.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session?.status, session?.currentProblemIndex, currentLevelId, makeChoice, startSession, pauseSession, resumeSession, restartSession]);
}
