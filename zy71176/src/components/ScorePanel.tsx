import { useGameStore } from '../game/state';
import { getLevelById } from '../game/levels';
import { formatTime } from '../game/rules';
import { Trophy, AlertTriangle, Heart, Clock, Star } from 'lucide-react';

export function ScorePanel() {
  const score = useGameStore((state) => state.score);
  const complaints = useGameStore((state) => state.complaints);
  const satisfaction = useGameStore((state) => state.satisfaction);
  const currentTime = useGameStore((state) => state.currentTime);
  const currentLevel = useGameStore((state) => state.currentLevel);
  const status = useGameStore((state) => state.status);

  const level = getLevelById(currentLevel);

  const getSatisfactionColor = () => {
    if (satisfaction >= 70) return 'text-green-400';
    if (satisfaction >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreColor = () => {
    if (score >= 100) return 'text-green-400';
    if (score >= 0) return 'text-blue-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">📊</span> 运营状态
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{formatTime(currentTime)}</span>
        </div>
      </div>

      {level && (
        <div className="mb-4 p-3 bg-gray-700/30 rounded-lg">
          <div className="text-sm text-secondary font-medium">{level.name}</div>
          <div className="text-xs text-gray-400 mt-1">{level.description}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">分数</span>
          </div>
          <div className={`text-2xl font-bold ${getScoreColor()}`}>{score}</div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400">满意度</span>
          </div>
          <div className={`text-2xl font-bold ${getSatisfactionColor()}`}>{satisfaction}%</div>
          <div className="mt-2 h-1.5 bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                satisfaction >= 70 ? 'bg-green-500' : satisfaction >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${satisfaction}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">客诉</span>
          </div>
          <div className={`text-2xl font-bold ${complaints >= 3 ? 'text-red-400' : 'text-white'}`}>
            {complaints}
            {level && <span className="text-sm text-gray-500">/{level.winConditions.maxComplaints}</span>}
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">状态</span>
          </div>
          <div className="text-lg font-medium">
            {status === 'playing' && <span className="text-green-400">运行中</span>}
            {status === 'paused' && <span className="text-yellow-400">已暂停</span>}
            {status === 'settlement' && <span className="text-blue-400">结算中</span>}
            {status === 'replay' && <span className="text-purple-400">回放中</span>}
            {status === 'menu' && <span className="text-gray-400">菜单</span>}
          </div>
        </div>
      </div>

      {level && (
        <div className="mt-4 p-3 bg-gray-700/30 rounded-lg">
          <div className="text-xs text-gray-400 mb-2">胜利条件</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">最低满意度</span>
              <span className={satisfaction >= level.winConditions.minSatisfaction ? 'text-green-400' : 'text-red-400'}>
                {level.winConditions.minSatisfaction}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">最大客诉</span>
              <span className={complaints < level.winConditions.maxComplaints ? 'text-green-400' : 'text-red-400'}>
                {level.winConditions.maxComplaints}次
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">最低分数</span>
              <span className={score >= level.winConditions.minScore ? 'text-green-400' : 'text-yellow-400'}>
                {level.winConditions.minScore}分
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
