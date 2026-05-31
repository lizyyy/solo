import { Play, Pause, SkipBack, SkipForward, RotateCcw, X, Settings } from 'lucide-react';
import type { ReplayState } from '@/types';

interface ReplayControlsProps {
  replayState: ReplayState | null;
  onPlay: () => void;
  onPause: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onStop: () => void;
  onSeek: (stepIndex: number) => void;
  onSpeedChange: (speed: number) => void;
}

export function ReplayControls({
  replayState,
  onPlay,
  onPause,
  onPrevStep,
  onNextStep,
  onStop,
  onSeek,
  onSpeedChange,
}: ReplayControlsProps) {
  if (!replayState || !replayState.session) return null;

  const { isPlaying, currentStepIndex, playbackSpeed, session } = replayState;
  const totalSteps = session.stepHistory.length;
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  const speeds = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-accent-400 flex items-center gap-2">
          <Play className="w-5 h-5" />
          回放控制
        </h3>
        <button
          onClick={onStop}
          className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="关闭回放"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-white/60">
            步骤 {currentStepIndex + 1} / {totalSteps}
          </span>
          <span className="text-accent-400 font-mono">{Math.round(progress)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max={totalSteps > 0 ? totalSteps - 1 : 0}
          value={currentStepIndex}
          onChange={(e) => onSeek(parseInt(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-500"
        />
      </div>

      <div className="flex items-center justify-center gap-2 mb-4">
        <button
          onClick={onPrevStep}
          disabled={currentStepIndex <= 0}
          className="p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="上一步"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        {isPlaying ? (
          <button
            onClick={onPause}
            className="p-4 rounded-full bg-accent-500 hover:bg-accent-600 text-primary-900 transition-colors"
            title="暂停"
          >
            <Pause className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={currentStepIndex >= totalSteps - 1}
            className="p-4 rounded-full bg-accent-500 hover:bg-accent-600 text-primary-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="播放"
          >
            <Play className="w-6 h-6" />
          </button>
        )}

        <button
          onClick={onNextStep}
          disabled={currentStepIndex >= totalSteps - 1}
          className="p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="下一步"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSeek(0)}
          className="p-3 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors ml-2"
          title="重新开始"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Settings className="w-4 h-4 text-white/50" />
        <span className="text-sm text-white/50 mr-2">倍速：</span>
        <div className="flex items-center gap-1">
          {speeds.map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                playbackSpeed === speed
                  ? 'bg-accent-500 text-primary-900 font-medium'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
