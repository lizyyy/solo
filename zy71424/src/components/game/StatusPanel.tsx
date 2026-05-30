import React from 'react';
import { Clock, Award, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { formatTime } from '@/engine/evidenceRecorder';

export const StatusPanel: React.FC = () => {
  const timeElapsed = useGameStore(state => state.timeElapsed);
  const totalDuration = useGameStore(state => state.totalDuration);
  const score = useGameStore(state => state.score);
  const events = useGameStore(state => state.events);
  const status = useGameStore(state => state.status);

  const unresolvedEvents = events.filter(e => !e.resolved);
  const resolvedEvents = events.filter(e => e.resolved);

  const progress = (timeElapsed / totalDuration) * 100;

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = () => {
    if (progress >= 80) return 'bg-red-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-gray-700">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
            <Clock size={16} />
            <span className="text-xs">演出时间</span>
          </div>
          <div className="text-2xl font-mono font-bold text-white">
            {formatTime(timeElapsed)}
          </div>
          <div className="w-full h-1 bg-gray-700 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-full ${getProgressColor()} transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
            <Award size={16} />
            <span className="text-xs">当前分数</span>
          </div>
          <div className={`text-3xl font-mono font-bold ${getScoreColor()}`}>
            {score.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">满分 100</div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-xs">已处理</span>
          </div>
          <div className="text-2xl font-mono font-bold text-green-400">
            {resolvedEvents.length}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
            <XCircle size={16} className="text-red-400" />
            <span className="text-xs">待处理</span>
          </div>
          <div className={`text-2xl font-mono font-bold ${
            unresolvedEvents.length > 0 ? 'text-red-400 animate-pulse' : 'text-gray-500'
          }`}>
            {unresolvedEvents.length}
          </div>
        </div>
      </div>

      {status === 'playing' && unresolvedEvents.length > 2 && (
        <div className="mt-4 flex items-center gap-2 p-2 bg-red-900/50 rounded-lg border border-red-500/50">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300">
            警告：多个问题未处理，分数正在快速扣除！
          </span>
        </div>
      )}
    </div>
  );
};
