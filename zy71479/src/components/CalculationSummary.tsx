import { Activity, BarChart3, CircleDot, TrendingUp } from 'lucide-react';
import type { CornerData } from '../types';
import { getStatusColor } from '../utils/calculations';

interface CalculationSummaryProps {
  corners: CornerData[];
}

const CalculationSummary = ({ corners }: CalculationSummaryProps) => {
  const validCorners = corners.filter((c) => !c.tire.isMissing);
  const maxGForce = Math.max(...validCorners.map((c) => c.centripetalForce), 0);
  const avgGripUtilization =
    validCorners.length > 0
      ? Math.round(
          validCorners.reduce((sum, c) => sum + c.gripUtilization, 0) / validCorners.length
        )
      : 0;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-teal-400" />
        计算汇总
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <CircleDot className="w-3 h-3 text-red-400" />
            最大向心力
          </div>
          <div className="text-xl font-bold text-white">
            {maxGForce}
            <span className="text-sm font-normal text-slate-400 ml-1">G</span>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            平均抓地利用率
          </div>
          <div className="text-xl font-bold text-white">
            {avgGripUtilization}
            <span className="text-sm font-normal text-slate-400 ml-1">%</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
          <Activity className="w-3 h-3 text-blue-400" />
          赛段对比
        </div>

        <div className="space-y-2">
          {corners.map((corner) => (
            <div key={corner.id} className="flex items-center gap-3">
              <span className="text-xs text-slate-300 w-16 truncate">
                {corner.cornerName}
              </span>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(corner.gripUtilization || 0, 100)}%`,
                    backgroundColor: getStatusColor(corner.status),
                  }}
                ></div>
              </div>
              <span className="text-xs text-slate-400 w-12 text-right">
                {corner.gripUtilization || '-'}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-900/30 rounded-lg border border-slate-700/20">
        <div className="text-xs text-slate-500 mb-2">计算公式说明</div>
        <div className="text-xs text-slate-400 space-y-1">
          <div>
            <code className="text-teal-400">向心力 G</code> = v² / (r × 9.81)
          </div>
          <div>
            <code className="text-emerald-400">抓地利用率</code> = 实际G / 阈值G × 100%
          </div>
          <div className="text-slate-500 mt-2">
            轮胎抓地阈值: Slick Soft=1.8G, Medium=1.6G, Hard=1.4G
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculationSummary;
