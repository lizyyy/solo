import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  FastForward,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { cn } from '../lib/utils';

interface ReplayPlayerProps {
  onClose: () => void;
}

export const ReplayPlayer: React.FC<ReplayPlayerProps> = ({ onClose }) => {
  const {
    isReplaying,
    replayRound,
    replaySpeed,
    game,
    rounds,
    startReplay,
    stopReplay,
    stepReplay,
    setReplaySpeed,
  } = useGameStore();

  const autoPlayRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  const maxRound = game?.currentRound || 1;
  const speeds = [0.5, 1, 2];

  useEffect(() => {
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, []);

  const toggleAutoPlay = () => {
    if (isPlayingRef.current) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  };

  const startAutoPlay = () => {
    isPlayingRef.current = true;
    autoPlayRef.current = window.setInterval(() => {
      if (replayRound && replayRound < maxRound) {
        stepReplay('next');
      } else {
        stopAutoPlay();
      }
    }, 2000 / replaySpeed);
  };

  const stopAutoPlay = () => {
    isPlayingRef.current = false;
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  };

  useEffect(() => {
    if (isPlayingRef.current && autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = window.setInterval(() => {
        if (replayRound && replayRound < maxRound) {
          stepReplay('next');
        } else {
          stopAutoPlay();
        }
      }, 2000 / replaySpeed);
    }
  }, [replaySpeed]);

  const handleRoundSelect = (round: number) => {
    startReplay(round);
  };

  if (!isReplaying) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-green-600 rounded text-sm font-bold animate-pulse">
              回放模式
            </div>
            <div className="text-lg font-bold">
              第 {replayRound} 回合 / {maxRound}
            </div>
            {rounds.find((r) => r.roundNumber === replayRound) && (
              <div className="text-sm text-gray-300">
                碳价: ¥
                {rounds.find((r) => r.roundNumber === replayRound)?.carbonPrice}/吨
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-4">
              {speeds.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setReplaySpeed(speed)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    replaySpeed === speed
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  )}
                >
                  {speed}x
                </button>
              ))}
              <FastForward className="w-4 h-4 ml-1 text-gray-400" />
            </div>

            <button
              onClick={() => stepReplay('prev')}
              disabled={replayRound === 1}
              className={cn(
                'p-2 rounded hover:bg-gray-700 transition-colors',
                replayRound === 1 && 'opacity-50 cursor-not-allowed'
              )}
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={toggleAutoPlay}
              className="p-2 bg-green-600 rounded hover:bg-green-700 transition-colors"
            >
              {isPlayingRef.current ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => stepReplay('next')}
              disabled={replayRound === maxRound}
              className={cn(
                'p-2 rounded hover:bg-gray-700 transition-colors',
                replayRound === maxRound && 'opacity-50 cursor-not-allowed'
              )}
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <div className="w-px h-8 bg-gray-700 mx-2" />

            <div className="flex items-center gap-1 max-w-md overflow-x-auto">
              {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => (
                <button
                  key={round}
                  onClick={() => handleRoundSelect(round)}
                  className={cn(
                    'w-8 h-8 rounded text-sm font-bold transition-colors flex-shrink-0',
                    replayRound === round
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  )}
                >
                  {round}
                </button>
              ))}
            </div>

            <div className="w-px h-8 bg-gray-700 mx-2" />

            <button
              onClick={() => {
                stopAutoPlay();
                stopReplay();
                onClose();
              }}
              className="p-2 bg-red-600 rounded hover:bg-red-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-2">
          <input
            type="range"
            min="1"
            max={maxRound}
            value={replayRound || 1}
            onChange={(e) => handleRoundSelect(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>
      </div>
    </div>
  );
};
