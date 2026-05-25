import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { Pause, Play, RotateCcw, Home } from 'lucide-react';

export default function TopBar() {
  const { phase, round, maxRounds, timeRemaining, pauseGame, resumeGame, restartGame, goToMenu } =
    useGameStore();

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

  const timeWarning = timeRemaining < 10;

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-night-panel border-b border-night-border">
      <div className="flex items-center gap-4">
        <button
          onClick={goToMenu}
          className="p-2 rounded-lg bg-night-card hover:bg-night-border transition-colors"
          title="返回菜单"
        >
          <Home size={20} className="text-neon-yellow" />
        </button>
        <div className="text-lg font-bold text-neon-orange">
          回合 {round}/{maxRounds}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">剩余时间</span>
        <span
          className={`text-2xl font-bold font-mono ${
            timeWarning ? 'text-neon-red animate-pulse' : 'text-neon-yellow'
          }`}
        >
          {formatTime(timeRemaining)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {phase === 'playing' && (
          <button
            onClick={pauseGame}
            className="p-2 rounded-lg bg-neon-yellow/20 hover:bg-neon-yellow/30 transition-colors"
            title="暂停"
          >
            <Pause size={20} className="text-neon-yellow" />
          </button>
        )}
        {phase === 'paused' && (
          <button
            onClick={resumeGame}
            className="p-2 rounded-lg bg-neon-cyan/20 hover:bg-neon-cyan/30 transition-colors"
            title="继续"
          >
            <Play size={20} className="text-neon-cyan" />
          </button>
        )}
        <button
          onClick={restartGame}
          className="p-2 rounded-lg bg-night-card hover:bg-night-border transition-colors"
          title="重新开始"
        >
          <RotateCcw size={20} className="text-neon-orange" />
        </button>
      </div>
    </div>
  );
}