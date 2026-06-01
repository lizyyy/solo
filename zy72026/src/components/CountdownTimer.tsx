import React from 'react';
import { Clock } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { levels } from '../data/levels';

export const CountdownTimer: React.FC = () => {
  const { session, currentLevelId } = useGameStore();
  const level = levels.find((l) => l.id === currentLevelId);
  const currentProblem = level?.problems[session?.currentProblemIndex ?? 0];

  if (!session || session.status === 'idle' || !currentProblem) {
    return (
      <div className="industrial-panel p-4 text-center">
        <div className="text-industrial-muted text-sm">等待开始</div>
        <div className="font-mono text-4xl font-bold text-industrial-muted mt-2">--:--</div>
      </div>
    );
  }

  const remainingSeconds = Math.ceil(session.remainingTime / 1000);
  const totalSeconds = currentProblem.timeLimit;
  const percentage = (remainingSeconds / totalSeconds) * 100;
  const isUrgent = remainingSeconds <= 3;

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`industrial-panel p-4 text-center ${isUrgent && session.status === 'running' ? 'animate-pulse-urgent border-red-500' : ''}`}>
      <div className="flex items-center justify-center gap-2 text-industrial-muted text-sm mb-2">
        <Clock size={16} />
        <span>剩余时间</span>
      </div>
      <div
        className={`font-mono text-5xl font-bold ${
          isUrgent ? 'text-red-500' : percentage > 50 ? 'text-emerald-400' : 'text-amber-400'
        }`}
      >
        {formatTime(session.remainingTime)}
      </div>
      <div className="w-full bg-industrial-border rounded-full h-2 mt-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-100 rounded-full ${
            isUrgent ? 'bg-red-500' : percentage > 50 ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-industrial-muted mt-2">
        第 {session.currentProblemIndex + 1} / {level?.problems.length || 0} 题
      </div>
    </div>
  );
};
