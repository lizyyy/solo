import React from 'react';
import { ScoreBreakdown } from '@/types';

interface ScoreDisplayProps {
  scores: ScoreBreakdown;
  showDetails?: boolean;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ scores, showDetails = false }) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-rose-400';
    if (score >= 0.75) return 'text-amber-400';
    if (score >= 0.6) return 'text-emerald-400';
    return 'text-slate-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 0.9) return 'bg-rose-500/20 border-rose-500/30';
    if (score >= 0.75) return 'bg-amber-500/20 border-amber-500/30';
    if (score >= 0.6) return 'bg-emerald-500/20 border-emerald-500/30';
    return 'bg-slate-500/20 border-slate-500/30';
  };

  return (
    <div className="space-y-3">
      <div className={`p-4 rounded-lg border ${getScoreBg(scores.overall)}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">综合相似度</span>
          <span className={`text-2xl font-bold ${getScoreColor(scores.overall)}`}>
            {(scores.overall * 100).toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              scores.overall >= 0.9
                ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                : scores.overall >= 0.75
                ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                : scores.overall >= 0.6
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-slate-500 to-slate-400'
            }`}
            style={{ width: `${scores.overall * 100}%` }}
          />
        </div>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="text-xs text-slate-500 mb-1">轮廓匹配</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-semibold ${getScoreColor(scores.contour.normalized)}`}>
                {(scores.contour.normalized * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500">
                ×{(scores.contour.weight * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              加权: {(scores.contour.weighted * 100).toFixed(1)}%
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="text-xs text-slate-500 mb-1">节奏匹配</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-semibold ${getScoreColor(scores.rhythm.normalized)}`}>
                {(scores.rhythm.normalized * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500">
                ×{(scores.rhythm.weight * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              加权: {(scores.rhythm.weighted * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 text-xs">
          <div className="text-slate-500 mb-2">计算公式</div>
          <code className="block text-slate-400 space-y-1">
            <div>轮廓归一化得分: {(scores.contour.normalized * 100).toFixed(1)}%</div>
            <div>节奏归一化得分: {(scores.rhythm.normalized * 100).toFixed(1)}%</div>
            <div className="text-amber-400 mt-2">
              综合 = {scores.contour.normalized.toFixed(3)} × {(scores.contour.weight).toFixed(2)} +{' '}
              {scores.rhythm.normalized.toFixed(3)} × {(scores.rhythm.weight).toFixed(2)}
            </div>
            <div className="text-amber-400">
              = {scores.contour.weighted.toFixed(3)} + {scores.rhythm.weighted.toFixed(3)} ={' '}
              {scores.overall.toFixed(3)}
            </div>
          </code>
        </div>
      )}
    </div>
  );
};

export default ScoreDisplay;
