import React from 'react';
import { Circle } from 'lucide-react';
import type { GameStatus } from '../types';
import { GAME_STATUS_LABELS } from '../types';

interface StatusIndicatorProps {
  status: GameStatus;
  pauseNote?: string;
}

const STATUS_COLORS: Record<GameStatus, string> = {
  idle: 'text-gray-400',
  playing: 'text-emerald-500',
  paused: 'text-amber-500',
  ended: 'text-slate-400',
  playback: 'text-blue-500',
};

const STATUS_BG: Record<GameStatus, string> = {
  idle: 'bg-gray-400/20',
  playing: 'bg-emerald-500/20',
  paused: 'bg-amber-500/20',
  ended: 'bg-slate-400/20',
  playback: 'bg-blue-500/20',
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, pauseNote }) => {
  const isBlinking = status === 'playing' || status === 'playback';

  return (
    <div className="flex items-center gap-3">
      <div className={`relative flex items-center justify-center w-12 h-12 rounded-lg ${STATUS_BG[status]}`}>
        <Circle
          className={`w-6 h-6 ${STATUS_COLORS[status]} ${isBlinking ? 'animate-pulse' : ''}`}
          fill="currentColor"
        />
        {isBlinking && (
          <Circle
            className={`absolute w-6 h-6 ${STATUS_COLORS[status]} animate-ping opacity-50`}
            fill="currentColor"
          />
        )}
      </div>
      <div>
        <div className={`font-bold text-lg ${STATUS_COLORS[status]}`}>
          {GAME_STATUS_LABELS[status]}
        </div>
        {pauseNote && (
          <div className="text-xs text-amber-400 mt-0.5 max-w-[200px] truncate">
            暂停原因: {pauseNote}
          </div>
        )}
      </div>
    </div>
  );
};
