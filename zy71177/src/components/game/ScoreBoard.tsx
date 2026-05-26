import React from 'react';
import { Trophy, Coins, Target, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';

interface ScoreBoardProps {
  round: number;
  maxRounds: number;
  score: number;
  totalCost: number;
  successCount: number;
  insufficientStirringCount: number;
  overdoseCount: number;
  levelName: string;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  round,
  maxRounds,
  score,
  totalCost,
  successCount,
  insufficientStirringCount,
  overdoseCount,
  levelName
}) => {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{levelName}</h3>
        <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
          回合 {round}/{maxRounds}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} className="text-yellow-400" />
            <span className="text-xs text-yellow-400">当前得分</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{score}</div>
        </div>

        <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-500/30">
          <div className="flex items-center gap-2 mb-1">
            <Coins size={16} className="text-cyan-400" />
            <span className="text-xs text-cyan-400">累计成本</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">¥{totalCost.toFixed(0)}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-sm text-slate-400">达标回合</span>
          </div>
          <span className="font-mono text-green-400 font-bold">{successCount}</span>
        </div>

        <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-orange-400" />
            <span className="text-sm text-slate-400">搅拌不足</span>
          </div>
          <span className={`font-mono font-bold ${insufficientStirringCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
            {insufficientStirringCount}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-sm text-slate-400">超量投加</span>
          </div>
          <span className={`font-mono font-bold ${overdoseCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {overdoseCount}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>进度</span>
          <span>{Math.round((round / maxRounds) * 100)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${(round / maxRounds) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};
