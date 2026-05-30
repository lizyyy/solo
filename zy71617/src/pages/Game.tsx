import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BeatTrack } from '@/components/BeatTrack';
import { Platform } from '@/components/Platform';
import { GameHUD } from '@/components/GameHUD';
import { ControlPanel } from '@/components/ControlPanel';
import { TrainDisplay } from '@/components/TrainDisplay';
import { PauseModal } from '@/components/PauseModal';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useGameStore } from '@/store/gameStore';

const Game = () => {
  const navigate = useNavigate();
  const { status, platforms, dispatchTrain, currentTime } = useGameStore();
  const { reset: resetGameLoop } = useGameLoop();

  const leftPlatforms = platforms.slice(0, 3);
  const rightPlatforms = platforms.slice(3, 6);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (status === 'playing') {
        dispatchTrain(currentTime);
      } else if (status === 'paused') {
        useGameStore.getState().resumeGame();
      }
    } else if (e.code === 'Escape') {
      if (status === 'playing') {
        useGameStore.getState().pauseGame();
      } else if (status === 'paused') {
        useGameStore.getState().resumeGame();
      }
    }
  }, [status, dispatchTrain, currentTime]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (status === 'ended') {
      navigate('/report');
    }
  }, [status, navigate]);

  useEffect(() => {
    if (status === 'idle') {
      navigate('/');
    }
  }, [status, navigate]);

  useEffect(() => {
    return () => {
      resetGameLoop();
    };
  }, [resetGameLoop]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <GameHUD />
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 flex flex-col gap-3">
            {leftPlatforms.map((platform) => (
              <Platform key={platform.id} platform={platform} position="left" />
            ))}
          </div>

          <div className="flex flex-col items-center justify-center py-4">
            <BeatTrack />
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {rightPlatforms.map((platform) => (
              <Platform key={platform.id} platform={platform} position="right" />
            ))}
          </div>
        </div>

        <div className="mb-4">
          <TrainDisplay />
        </div>

        <div className="flex justify-center">
          <ControlPanel />
        </div>
      </div>

      <PauseModal />
    </div>
  );
};

export default Game;
