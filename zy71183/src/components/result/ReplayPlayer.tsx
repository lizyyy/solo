import { Play, Pause, RotateCcw, SkipBack, SkipForward, Gauge } from 'lucide-react';
import type { OperationRecord } from '../../types';

interface ReplayPlayerProps {
  operations: OperationRecord[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSeekTo: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  currentOperation: OperationRecord | null;
  totalOperations: number;
}

export function ReplayPlayer({
  operations,
  currentIndex,
  isPlaying,
  progress,
  speed,
  onPlay,
  onPause,
  onReset,
  onSeekTo,
  onSpeedChange,
  currentOperation,
  totalOperations,
}: ReplayPlayerProps) {
  if (operations.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
        <h2 className="text-xl font-semibold text-white mb-4">历史回放</h2>
        <p className="text-slate-400 text-center py-8">暂无操作记录</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
      <h2 className="text-xl font-semibold text-white mb-4">历史回放</h2>
      
      {currentOperation && (
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">
              操作 {currentIndex + 1} / {totalOperations}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded ${
              currentOperation.isCorrect ? 'bg-green-600' : 'bg-industrial-red'
            }`}>
              {currentOperation.isCorrect ? '正确' : '错误'}
            </span>
          </div>
          <p className="text-white">{currentOperation.details}</p>
          <p className="text-xs text-slate-500 mt-1">
            类型: {currentOperation.type === 'inspect' ? '巡检' : 
                   currentOperation.type === 'anomaly_handle' ? '处理异常' :
                   currentOperation.type === 'anomaly_upgrade' ? '升级异常' : '生成报告'}
          </p>
        </div>
      )}
      
      <div className="mb-4">
        <div 
          className="h-2 bg-slate-700 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const progress = clickX / rect.width;
            const newIndex = Math.floor(progress * totalOperations);
            onSeekTo(newIndex);
          }}
        >
          <div 
            className="h-full bg-industrial-blue transition-all duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSeekTo(Math.max(-1, currentIndex - 1))}
            disabled={currentIndex <= 0}
            className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          
          {isPlaying ? (
            <button
              onClick={onPause}
              className="p-3 bg-industrial-blue rounded-lg hover:bg-blue-700"
            >
              <Pause className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="p-3 bg-industrial-blue rounded-lg hover:bg-blue-700"
            >
              <Play className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={() => onSeekTo(Math.min(totalOperations - 1, currentIndex + 1))}
            disabled={currentIndex >= totalOperations - 1}
            className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          
          <button
            onClick={onReset}
            className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 ml-2"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-slate-400" />
          <select
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
        </div>
      </div>
    </div>
  );
}
