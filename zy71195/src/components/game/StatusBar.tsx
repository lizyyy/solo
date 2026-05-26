import { Clock, Target, CheckCircle, XCircle, Trophy, Timer } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useTimer } from '../../hooks/useTimer';

export function StatusBar() {
  const { gameState, currentVehicleIndex, allVehicles } = useGameStore();
  const { remainingTime, timeProgress } = useTimer();

  const accuracy = gameState.processedCount > 0
    ? Math.round((gameState.correctCount / gameState.processedCount) * 100)
    : 0;

  const getTimeColor = () => {
    if (timeProgress > 0.6) return 'bg-green-500';
    if (timeProgress > 0.3) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTimeTextColor = () => {
    if (timeProgress > 0.6) return 'text-green-400';
    if (timeProgress > 0.3) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-900 border-2 border-slate-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-400 text-sm">得分</span>
            <span className={`text-xl font-bold font-mono ${gameState.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {gameState.score}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            <span className="text-slate-400 text-sm">进度</span>
            <span className="text-xl font-bold font-mono text-blue-400">
              {currentVehicleIndex + 1}/{allVehicles.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-slate-400 text-sm">正确</span>
            <span className="text-xl font-bold font-mono text-green-400">
              {gameState.correctCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-slate-400 text-sm">错误</span>
            <span className="text-xl font-bold font-mono text-red-400">
              {gameState.processedCount - gameState.correctCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">准确率</span>
            <span className={`text-xl font-bold font-mono ${accuracy >= 80 ? 'text-green-400' : accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {accuracy}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Timer className={`w-5 h-5 ${getTimeTextColor()}`} />
            <div className="w-32">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">剩余时间</span>
                <span className={`font-mono font-bold ${getTimeTextColor()}`}>
                  {remainingTime.toFixed(1)}s
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getTimeColor()} transition-all duration-100`}
                  style={{ width: `${timeProgress * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500">关卡</div>
            <div className="text-sm font-bold text-slate-300">
              {gameState.level.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
