import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Home } from 'lucide-react';
import { GameAction } from '../../types';

interface ReplayTimelineProps {
  currentIndex: number;
  totalPoints: number;
  actions: GameAction[];
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (index: number) => void;
  onBackToMenu: () => void;
}

export const ReplayTimeline: React.FC<ReplayTimelineProps> = ({
  currentIndex,
  totalPoints,
  actions,
  isPlaying,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onSeek,
  onBackToMenu
}) => {
  const actionIndices = actions.map(a => a.round * 2 - 1);

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">历史回放</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">
            时间点 {currentIndex + 1} / {totalPoints}
          </span>
        </div>
      </div>

      <div className="relative mb-4">
        <input
          type="range"
          min="0"
          max={totalPoints - 1}
          value={currentIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        
        <div className="absolute top-0 left-0 w-full pointer-events-none">
          {actionIndices.map((idx, i) => (
            <div
              key={i}
              className="absolute top-0 w-1 h-4 bg-yellow-400 rounded"
              style={{ left: `${(idx / (totalPoints - 1)) * 100}%`, transform: 'translateX(-50%)' }}
              title={`回合 ${actions[i].round}`}
            ></div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onBackToMenu}
          className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-all"
          title="返回菜单"
        >
          <Home size={20} />
        </button>
        
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SkipBack size={20} />
        </button>
        
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all shadow-lg shadow-blue-500/30"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        <button
          onClick={onNext}
          disabled={currentIndex >= totalPoints - 1}
          className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SkipForward size={20} />
        </button>
      </div>

      {currentIndex > 0 && actions[Math.floor((currentIndex - 1) / 2)] && (
        <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">当前操作</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">
              回合 {actions[Math.floor((currentIndex - 1) / 2)]?.round}
            </span>
            <span className="font-mono text-blue-400">
              投加 {actions[Math.floor((currentIndex - 1) / 2)]?.chemicalAmount?.toFixed(0)} 单位
            </span>
            <span className="font-mono text-green-400">
              搅拌 {actions[Math.floor((currentIndex - 1) / 2)]?.stirringTime?.toFixed(0)} 秒
            </span>
            <span className="font-mono text-cyan-400">
              成本 ¥{actions[Math.floor((currentIndex - 1) / 2)]?.cost.toFixed(0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
