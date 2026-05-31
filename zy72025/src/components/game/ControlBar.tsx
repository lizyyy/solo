import { Play, Pause, RotateCcw, Flag, User, Clock, Info } from 'lucide-react';
import type { GameSession } from '@/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';
import { formatDateTime } from '@/utils/helpers';

interface ControlBarProps {
  session: GameSession | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onEnd: () => void;
  isLoading?: boolean;
}

export function ControlBar({
  session,
  onStart,
  onPause,
  onResume,
  onRestart,
  onEnd,
  isLoading = false,
}: ControlBarProps) {
  const isPlaying = session?.status === 'playing';
  const isPaused = session?.status === 'paused';
  const isCompleted = session?.status === 'completed';
  const isIdle = !session || session.status === 'idle';
  const isInterrupted = session?.status === 'interrupted';

  const getStatusBadge = () => {
    if (!session) return null;
    const color = STATUS_COLORS[session.status];
    const label = STATUS_LABELS[session.status];
    
    return (
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
        <span className="text-sm text-white/70">{label}</span>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {session && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-accent-400" />
                <span className="text-white/70">玩家：</span>
                <span className="text-white font-medium">{session.playerName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-accent-400" />
                <span className="text-white/70">关卡：</span>
                <span className="text-white font-medium">{session.levelName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-accent-400" />
                <span className="text-white/70">开始：</span>
                <span className="text-white font-medium">{formatDateTime(session.startTime)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/70">步骤：</span>
                <span className="text-white font-medium">{session.stepHistory.length}</span>
              </div>
            </>
          )}
          {getStatusBadge()}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isIdle && (
            <button
              onClick={onStart}
              disabled={isLoading}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>开始游戏</span>
            </button>
          )}

          {isPlaying && (
            <>
              <button
                onClick={onPause}
                disabled={isLoading}
                className="btn-secondary flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                <span>暂停</span>
              </button>
              <button
                onClick={onRestart}
                disabled={isLoading}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>重开</span>
              </button>
              <button
                onClick={onEnd}
                disabled={isLoading}
                className="btn-accent flex items-center gap-2"
              >
                <Flag className="w-4 h-4" />
                <span>结算</span>
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={onResume}
                disabled={isLoading}
                className="btn-primary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>继续</span>
              </button>
              <button
                onClick={onRestart}
                disabled={isLoading}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>重开</span>
              </button>
            </>
          )}

          {isCompleted && (
            <button
              onClick={onRestart}
              disabled={isLoading}
              className="btn-primary flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>再来一局</span>
            </button>
          )}

          {isInterrupted && (
            <>
              <button
                onClick={onResume}
                disabled={isLoading}
                className="btn-primary flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>继续处理</span>
              </button>
              <button
                onClick={onRestart}
                disabled={isLoading}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>重开</span>
              </button>
            </>
          )}
        </div>
      </div>

      {session?.hasNegativeResources && (
        <div className="mt-4 p-3 bg-danger-500/20 border border-danger-500/30 rounded-lg">
          <p className="text-sm text-danger-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
            资源状态异常（出现负数），请补充材料后继续处理
          </p>
        </div>
      )}
    </div>
  );
}
