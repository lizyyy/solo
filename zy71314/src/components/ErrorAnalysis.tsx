import { AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react';
import { usePendulumStore } from '@/store/usePendulumStore';
import { formatNumber } from '@/utils/statistics';

export default function ErrorAnalysis() {
  const { result } = usePendulumStore();

  if (!result) {
    return (
      <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          误差分析
        </h2>
        <div className="text-center py-8 text-slate-500">
          <div className="text-4xl mb-2">🔍</div>
          <p>请先进行计算以查看误差分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        误差来源分析
      </h2>

      <div className="space-y-4">
        {result.errorSources.map((source, index) => (
          <div
            key={index}
            className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  index === 0 ? 'bg-blue-500' :
                  index === 1 ? 'bg-green-500' :
                  index === 2 ? 'bg-amber-500' :
                  index === 3 ? 'bg-red-500' : 'bg-purple-500'
                }`} />
                <span className="font-medium text-white">{source.name}</span>
              </div>
              <span className="text-lg font-bold text-white">
                {formatNumber(source.contribution, 1)}%
              </span>
            </div>

            <div className="w-full bg-slate-600/50 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  index === 0 ? 'bg-blue-500' :
                  index === 1 ? 'bg-green-500' :
                  index === 2 ? 'bg-amber-500' :
                  index === 3 ? 'bg-red-500' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(source.contribution, 100)}%` }}
              />
            </div>

            <p className="text-slate-400 text-sm mb-2">{source.description}</p>

            <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded-lg">
              <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300">
                <span className="text-amber-400 font-medium">改进建议：</span>
                {source.improvement}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-400 font-medium">实验要点总结</p>
            <ul className="text-blue-300/70 text-sm mt-2 space-y-1">
              <li>• 保持摆角小于15度以确保小角度近似成立</li>
              <li>• 测量多个周期的总时间以减小计时误差</li>
              <li>• 确保单摆在竖直平面内摆动，避免圆锥摆</li>
              <li>• 多次测量取平均值，使用更长的摆长</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
