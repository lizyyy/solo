import { Clock, Target, AlertTriangle, Trophy, Zap } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { getLevelConfig } from '@/utils/levelConfigs';

export const HUD = () => {
  const timeRemaining = useGameStore(state => state.timeRemaining);
  const score = useGameStore(state => state.score);
  const correctCount = useGameStore(state => state.correctCount);
  const errorCount = useGameStore(state => state.errorCount);
  const levelId = useGameStore(state => state.levelId);
  const status = useGameStore(state => state.status);
  const transferTimeoutCount = useGameStore(state => state.transferTimeoutCount);
  const oversizeErrorCount = useGameStore(state => state.oversizeErrorCount);

  const level = getLevelConfig(levelId);
  const total = correctCount + errorCount;
  const accuracy = total > 0 ? ((correctCount / total) * 100).toFixed(1) : '100.0';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeRemaining < 30) return 'text-red-400';
    if (timeRemaining < 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  const isPlaying = status === 'playing';

  return (
    <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-auto">
      <div className="flex justify-between items-start gap-4">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-gray-700 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400 text-sm font-medium">剩余时间</span>
          </div>
          <div className={`text-4xl font-bold font-mono ${getTimeColor()} ${isPlaying ? 'animate-pulse' : ''}`}>
            {formatTime(timeRemaining)}
          </div>
          {level && (
            <div className="text-sm text-gray-400 mt-1">
              {level.name}
            </div>
          )}
        </div>

        <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-gray-700 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400 text-sm font-medium">得分</span>
          </div>
          <div className="text-4xl font-bold font-mono text-yellow-400">
            {score.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            准确率 {accuracy}%
          </div>
        </div>

        <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-gray-700 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-green-400" />
            <span className="text-gray-400 text-sm font-medium">分拣统计</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-gray-300">正确</span>
              <span className="text-green-400 font-mono font-bold ml-auto">{correctCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-gray-300">错误</span>
              <span className="text-red-400 font-mono font-bold ml-auto">{errorCount}</span>
            </div>
            {level?.hasTransfer && (
              <div className="flex items-center gap-2 col-span-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <span className="text-gray-300">转机超时</span>
                <span className="text-orange-400 font-mono font-bold ml-auto">{transferTimeoutCount}</span>
              </div>
            )}
            {level?.hasOversize && (
              <div className="flex items-center gap-2 col-span-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-gray-300">超规错误</span>
                <span className="text-red-400 font-mono font-bold ml-auto">{oversizeErrorCount}</span>
              </div>
            )}
          </div>
        </div>

        {level && (
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-gray-700 shadow-xl min-w-[200px]">
            <div className="text-gray-400 text-sm font-medium mb-2">通关条件</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">准确率≥</span>
                <span className={`font-mono ${parseFloat(accuracy) >= level.passConditions.minAccuracy * 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {(level.passConditions.minAccuracy * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">错误≤</span>
                <span className={`font-mono ${errorCount <= level.passConditions.maxErrors ? 'text-green-400' : 'text-red-400'}`}>
                  {level.passConditions.maxErrors}
                </span>
              </div>
              {level.passConditions.maxTransferTimeouts !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">转机超时≤</span>
                  <span className={`font-mono ${transferTimeoutCount <= level.passConditions.maxTransferTimeouts ? 'text-green-400' : 'text-red-400'}`}>
                    {level.passConditions.maxTransferTimeouts}
                  </span>
                </div>
              )}
              {level.passConditions.maxOversizeErrors !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">超规错误≤</span>
                  <span className={`font-mono ${oversizeErrorCount <= level.passConditions.maxOversizeErrors ? 'text-green-400' : 'text-red-400'}`}>
                    {level.passConditions.maxOversizeErrors}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
