import { useGameStore } from '../store/gameStore';
import { GAME_STATUSES, TRAIN_STATUSES, CONFLICT_TYPES } from '../types/game';
import { Trophy, XCircle, RotateCcw, Home, FastForward } from 'lucide-react';

interface GameOverProps {
  onBackToMenu: () => void;
  onReplay: () => void;
}

export default function GameOver({ onBackToMenu, onReplay }: GameOverProps) {
  const { status, score, level, trains, conflicts, events, time, restartGame } = useGameStore();

  if (status !== GAME_STATUSES.WON && status !== GAME_STATUSES.LOST) {
    return null;
  }

  const isWin = status === GAME_STATUSES.WON;

  const completedTrains = trains.filter(t => t.status === TRAIN_STATUSES.COMPLETED);
  const totalDelay = trains.reduce((sum, t) => sum + Math.max(0, t.delay), 0);
  const avgDelay = completedTrains.length > 0 
    ? Math.floor(totalDelay / completedTrains.length) 
    : 0;

  const getConflictTypeLabel = (type: string) => {
    switch (type) {
      case CONFLICT_TYPES.SECTION_OCCUPANCY:
        return '区间占用冲突';
      case CONFLICT_TYPES.SIGNAL_VIOLATION:
        return '信号违规';
      case CONFLICT_TYPES.MAINTENANCE_CONFLICT:
        return '检修窗口冲突';
      case CONFLICT_TYPES.OVERSPEED:
        return '超速冲突';
      case CONFLICT_TYPES.TIMEOUT:
        return '超时失败';
      default:
        return '未知冲突';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-slate-700">
        <div className="text-center mb-6">
          {isWin ? (
            <>
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-bold text-emerald-400 mb-2">调度成功！</h2>
              <p className="text-slate-400">所有列车安全抵达目的地</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-3xl font-bold text-red-400 mb-2">调度失败</h2>
              <p className="text-slate-400">发生运行冲突或超时</p>
            </>
          )}
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">最终得分</div>
              <div className={`text-3xl font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                {score}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">目标分数</div>
              <div className="text-3xl font-bold text-slate-300">
                {level?.targetScore}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">完成列车</div>
              <div className="text-2xl font-bold text-blue-400">
                {completedTrains.length}/{trains.length}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-1">平均晚点</div>
              <div className={`text-2xl font-bold ${avgDelay > 50 ? 'text-amber-400' : 'text-slate-300'}`}>
                {avgDelay}
              </div>
            </div>
          </div>
        </div>

        {!isWin && conflicts.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="text-sm font-semibold text-red-400 mb-2">失败原因</div>
            {conflicts.map((conflict, i) => (
              <div key={i} className="text-sm text-slate-300">
                <span className="text-red-400">[{getConflictTypeLabel(conflict.type)}]</span>
                {' '}{conflict.message}
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-700/30 rounded-xl p-4 mb-6 max-h-40 overflow-y-auto">
          <div className="text-sm font-semibold text-slate-400 mb-2">运行报告</div>
          <div className="space-y-1">
            {trains.map(train => (
              <div key={train.id} className="flex items-center gap-3 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: train.color }}
                />
                <span className="font-mono text-slate-200 w-14">{train.name}</span>
                <span className={`flex-1 ${
                  train.status === TRAIN_STATUSES.COMPLETED 
                    ? 'text-emerald-400' 
                    : 'text-red-400'
                }`}>
                  {train.status === TRAIN_STATUSES.COMPLETED ? '已完成' : '未完成'}
                </span>
                <span className={`font-mono ${
                  train.delay === 0 ? 'text-emerald-400' :
                  train.delay < 50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {train.delay === 0 ? '正点' : `+${Math.floor(train.delay)}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBackToMenu}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-600 hover:bg-slate-500 rounded-xl font-semibold transition-colors"
          >
            <Home className="w-5 h-5" />
            返回菜单
          </button>
          <button
            onClick={restartGame}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            重新开始
          </button>
          <button
            onClick={onReplay}
            className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold transition-colors px-4"
            title="保存回放"
          >
            <FastForward className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
