import { Score } from '../../types/game';
import { Trophy, AlertTriangle, Clock, Zap, XCircle, Route } from 'lucide-react';

interface ScoreBoardProps {
  score: Score;
  isLive?: boolean;
}

export function ScoreBoard({ score, isLive = false }: ScoreBoardProps) {
  const ratingColors: Record<Score['rating'], string> = {
    S: 'text-yellow-400',
    A: 'text-green-400',
    B: 'text-blue-400',
    C: 'text-purple-400',
    D: 'text-orange-400',
    F: 'text-red-400',
  };

  return (
    <div className={`p-4 rounded-lg ${isLive ? 'bg-gray-800/50' : 'bg-gray-800'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          得分详情
        </h3>
        <div className={`text-3xl font-bold ${ratingColors[score.rating]}`}>
          {score.rating}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">基础得分</span>
          <span className="text-green-400">+{score.baseScore}</span>
        </div>
        
        {score.efficiencyBonus > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> 效率奖励
            </span>
            <span className="text-green-400">+{score.efficiencyBonus}</span>
          </div>
        )}

        {score.collisionPenalty > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> 碰撞扣分
            </span>
            <span className="text-red-400">-{score.collisionPenalty}</span>
          </div>
        )}

        {score.timeoutPenalty > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> 超时扣分
            </span>
            <span className="text-red-400">-{score.timeoutPenalty}</span>
          </div>
        )}

        {score.batteryPenalty > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center gap-1">
              <Zap className="w-3 h-3" /> 电量耗尽扣分
            </span>
            <span className="text-red-400">-{score.batteryPenalty}</span>
          </div>
        )}

        {score.invalidPathPenalty > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center gap-1">
              <Route className="w-3 h-3" /> 无效路径扣分
            </span>
            <span className="text-red-400">-{score.invalidPathPenalty}</span>
          </div>
        )}

        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="flex justify-between items-center font-semibold">
            <span className="text-white">总分</span>
            <span className="text-xl text-white">{score.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
