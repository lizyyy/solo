import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Square, History } from 'lucide-react';
import type { GameStatus } from '../types';

interface GameControlsProps {
  status: GameStatus;
  onStart: () => void;
  onPause: (note: string) => void;
  onResume: () => void;
  onRestart: () => void;
  onEnd: () => void;
  onPlayback: () => void;
  hasRecords: boolean;
  isConfigValid: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  status,
  onStart,
  onPause,
  onResume,
  onRestart,
  onEnd,
  onPlayback,
  hasRecords,
  isConfigValid,
}) => {
  const [pauseNote, setPauseNote] = useState('');
  const [showPauseInput, setShowPauseInput] = useState(false);

  const handlePauseClick = () => {
    if (status === 'playing') {
      setShowPauseInput(true);
    }
  };

  const handleConfirmPause = () => {
    onPause(pauseNote || '未填写暂停原因');
    setPauseNote('');
    setShowPauseInput(false);
  };

  const handleCancelPause = () => {
    setPauseNote('');
    setShowPauseInput(false);
  };

  const buttonBase = "flex-1 py-4 px-3 font-bold text-sm transition-all duration-200 border-2 rounded flex flex-col items-center gap-2";
  const buttonEnabled = "hover:scale-105 active:scale-95 cursor-pointer";
  const buttonDisabled = "opacity-40 cursor-not-allowed";

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          className={`${buttonBase} border-emerald-600 bg-emerald-600/20 text-emerald-400 ${
            status === 'idle' && isConfigValid ? buttonEnabled : buttonDisabled
          }`}
          onClick={onStart}
          disabled={status !== 'idle' || !isConfigValid}
        >
          <Play className="w-6 h-6" fill="currentColor" />
          <span>开始</span>
        </button>

        {status === 'playing' && !showPauseInput && (
          <button
            className={`${buttonBase} border-amber-600 bg-amber-600/20 text-amber-400 ${buttonEnabled}`}
            onClick={handlePauseClick}
          >
            <Pause className="w-6 h-6" fill="currentColor" />
            <span>暂停</span>
          </button>
        )}

        {status === 'paused' && (
          <button
            className={`${buttonBase} border-emerald-600 bg-emerald-600/20 text-emerald-400 ${buttonEnabled}`}
            onClick={onResume}
          >
            <Play className="w-6 h-6" fill="currentColor" />
            <span>继续</span>
          </button>
        )}

        <button
          className={`${buttonBase} border-slate-600 bg-slate-600/20 text-slate-400 ${
            status !== 'playback' ? buttonEnabled : buttonDisabled
          }`}
          onClick={onRestart}
          disabled={status === 'playback'}
        >
          <RotateCcw className="w-6 h-6" />
          <span>重开</span>
        </button>

        <button
          className={`${buttonBase} border-red-600 bg-red-600/20 text-red-400 ${
            status === 'playing' || status === 'paused' ? buttonEnabled : buttonDisabled
          }`}
          onClick={onEnd}
          disabled={status !== 'playing' && status !== 'paused'}
        >
          <Square className="w-6 h-6" fill="currentColor" />
          <span>结算</span>
        </button>

        <button
          className={`${buttonBase} border-blue-600 bg-blue-600/20 text-blue-400 ${
            (status === 'ended' || status === 'idle') && hasRecords ? buttonEnabled : buttonDisabled
          }`}
          onClick={onPlayback}
          disabled={(status !== 'ended' && status !== 'idle') || !hasRecords}
        >
          <History className="w-6 h-6" />
          <span>回放</span>
        </button>
      </div>

      {showPauseInput && (
        <div className="p-4 bg-amber-900/30 border-2 border-amber-600 rounded-lg animate-in fade-in slide-in-from-top-2">
          <div className="text-amber-400 font-bold mb-2">请输入暂停原因（给阿蓝交接用）</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={pauseNote}
              onChange={(e) => setPauseNote(e.target.value)}
              placeholder="例如：学生提问、设备故障、临时打断..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-amber-600/50 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmPause()}
            />
            <button
              onClick={handleConfirmPause}
              className="px-4 py-2 bg-amber-600 text-white font-bold rounded hover:bg-amber-500 transition-colors"
            >
              确认
            </button>
            <button
              onClick={handleCancelPause}
              className="px-4 py-2 bg-slate-600 text-white font-bold rounded hover:bg-slate-500 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
