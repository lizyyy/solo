import React from 'react';
import { AlertTriangle, Lightbulb, TrendingDown, Droplets, Timer } from 'lucide-react';
import { getFailReasonDescription } from '../../utils/scoring';

interface FailureAnalysisProps {
  failReason: string | null;
  success: boolean;
  totalCost: number;
  roundsCompleted: number;
  successCount: number;
  insufficientStirringCount: number;
  overdoseCount: number;
}

export const FailureAnalysis: React.FC<FailureAnalysisProps> = ({
  failReason,
  success,
  totalCost,
  roundsCompleted,
  successCount,
  insufficientStirringCount,
  overdoseCount
}) => {
  const failInfo = getFailReasonDescription(failReason);

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <AlertTriangle size={20} className={success ? 'text-green-400' : 'text-yellow-400'} />
        {success ? '游戏总结' : '失败分析'}
      </h3>

      {!success && failReason && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-yellow-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-400 mb-1">{failInfo.title}</h4>
              <p className="text-sm text-slate-300">{failInfo.suggestion}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-cyan-400" />
            <span className="text-xs text-slate-500">总成本</span>
          </div>
          <div className="text-xl font-mono font-bold text-cyan-400">¥{totalCost.toFixed(0)}</div>
        </div>
        <div className="p-3 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Droplets size={14} className="text-blue-400" />
            <span className="text-xs text-slate-500">完成回合</span>
          </div>
          <div className="text-xl font-mono font-bold text-blue-400">{roundsCompleted}</div>
        </div>
        <div className="p-3 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Droplets size={14} className="text-green-400" />
            <span className="text-xs text-slate-500">达标回合</span>
          </div>
          <div className="text-xl font-mono font-bold text-green-400">{successCount}</div>
        </div>
        <div className="p-3 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Timer size={14} className="text-purple-400" />
            <span className="text-xs text-slate-500">达标率</span>
          </div>
          <div className="text-xl font-mono font-bold text-purple-400">
            {roundsCompleted > 0 ? Math.round((successCount / roundsCompleted) * 100) : 0}%
          </div>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
        <Lightbulb size={14} />
        改进建议
      </h4>
      
      <div className="space-y-2">
        {insufficientStirringCount > 0 && (
          <div className="flex items-start gap-2 p-3 bg-orange-500/10 rounded-lg">
            <Timer size={16} className="text-orange-400 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-orange-400">增加搅拌时间</span>
              <p className="text-xs text-slate-400 mt-0.5">
                本次有 {insufficientStirringCount} 次搅拌不足，确保搅拌时间达到最低要求以获得最佳处理效果。
              </p>
            </div>
          </div>
        )}
        
        {overdoseCount > 0 && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg">
            <Droplets size={16} className="text-red-400 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-red-400">控制药剂投加量</span>
              <p className="text-xs text-slate-400 mt-0.5">
                本次有 {overdoseCount} 次超量投加，参考建议投加量以节省成本并避免指标反弹。
              </p>
            </div>
          </div>
        )}
        
        {totalCost > 1000 && (
          <div className="flex items-start gap-2 p-3 bg-cyan-500/10 rounded-lg">
            <TrendingDown size={16} className="text-cyan-400 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-cyan-400">优化成本控制</span>
              <p className="text-xs text-slate-400 mt-0.5">
                当前成本较高，尝试在保证处理效果的前提下减少药剂和搅拌成本。
              </p>
            </div>
          </div>
        )}

        {success && insufficientStirringCount === 0 && overdoseCount === 0 && (
          <div className="flex items-start gap-2 p-3 bg-green-500/10 rounded-lg">
            <Lightbulb size={16} className="text-green-400 mt-0.5" />
            <div>
              <span className="text-sm font-medium text-green-400">操作优秀！</span>
              <p className="text-xs text-slate-400 mt-0.5">
                你的操作非常规范！尝试挑战更高难度的关卡。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
