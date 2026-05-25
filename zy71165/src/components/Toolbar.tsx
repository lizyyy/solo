import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Undo2,
  CheckCircle,
  Home,
} from 'lucide-react';
import type { GameStatus } from '../engine/types';

interface ToolbarProps {
  gameStatus: GameStatus;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onUndo: () => void;
  onSettle: () => void;
  onBack: () => void;
  canUndo: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  gameStatus,
  onPause,
  onResume,
  onRestart,
  onUndo,
  onSettle,
  onBack,
  canUndo,
}) => {
  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-3 flex items-center gap-2 border border-slate-700">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-slate-300 hover:text-white"
      >
        <Home className="w-4 h-4" />
        <span className="text-sm">返回</span>
      </button>

      <div className="w-px h-8 bg-slate-600 mx-2" />

      {gameStatus === 'playing' ? (
        <button
          onClick={onPause}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-all text-white"
        >
          <Pause className="w-4 h-4" />
          <span className="text-sm">暂停</span>
        </button>
      ) : gameStatus === 'paused' ? (
        <button
          onClick={onResume}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-all text-white"
        >
          <Play className="w-4 h-4" />
          <span className="text-sm">继续</span>
        </button>
      ) : null}

      <button
        onClick={onRestart}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-slate-300 hover:text-white"
      >
        <RotateCcw className="w-4 h-4" />
        <span className="text-sm">重开</span>
      </button>

      <button
        onClick={onUndo}
        disabled={!canUndo || gameStatus !== 'playing'}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Undo2 className="w-4 h-4" />
        <span className="text-sm">撤销</span>
      </button>

      <div className="flex-1" />

      {gameStatus === 'playing' && (
        <button
          onClick={onSettle}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all text-white font-semibold shadow-lg shadow-blue-600/30"
        >
          <CheckCircle className="w-5 h-5" />
          <span>提交结算</span>
        </button>
      )}
    </div>
  );
};
