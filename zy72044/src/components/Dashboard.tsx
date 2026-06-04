import { useGameStore } from '@/store/useGameStore';
import { getResourceColorClass, getResourceBarPercent } from '@/utils/formatUtils';
import { Timer, Zap, Wallet, AlertTriangle } from 'lucide-react';

const resourceMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  time: { label: '时间', icon: <Timer size={16} />, color: 'from-blue-500 to-blue-400' },
  energy: { label: '能量', icon: <Zap size={16} />, color: 'from-yellow-500 to-yellow-400' },
  budget: { label: '预算', icon: <Wallet size={16} />, color: 'from-purple-500 to-purple-400' },
};

export default function Dashboard() {
  const { engineState, currentConfig } = useGameStore();
  const { resources } = engineState;
  const boundaries = currentConfig?.resourceBoundaries || {};
  const hasNegative = Object.values(resources).some(v => v < 0);
  const hasAnomalies = engineState.anomalies.length > 0;

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-800/80 rounded-xl border border-slate-700/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">资源仪表盘</h3>
        {hasNegative && (
          <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
            <AlertTriangle size={12} /> 资源为负
          </span>
        )}
        {hasAnomalies && !hasNegative && (
          <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
            <AlertTriangle size={12} /> 有异常
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(resources).map(([key, value]) => {
          const meta = resourceMeta[key] || { label: key, icon: null, color: 'from-gray-500 to-gray-400' };
          const boundary = boundaries[key] || { min: 0, max: 100 };
          const percent = getResourceBarPercent(value, boundary.min, boundary.max);
          const colorClass = getResourceColorClass(value, boundary.min, boundary.max);
          const isNeg = value < 0;

          return (
            <div
              key={key}
              className={`flex flex-col gap-2 p-3 rounded-lg border ${
                isNeg ? 'bg-red-950/30 border-red-500/30' : 'bg-slate-900/50 border-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                {meta.icon}
                {meta.label}
              </div>
              <div className={`text-xl font-mono font-bold tabular-nums ${colorClass}`}>
                {value}
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${meta.color} rounded-full transition-all duration-300`}
                  style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>下限 {boundary.min}</span>
                <span>上限 {boundary.max}</span>
              </div>
            </div>
          );
        })}
      </div>

      {engineState.needsManualReview && (
        <div className="p-3 bg-yellow-950/30 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-300 text-sm font-medium">
            <AlertTriangle size={14} />
            这条记录需要人工确认
          </div>
          <p className="text-xs text-yellow-400/70 mt-1">
            资源出现异常值，建议助教手动检查后再归档
          </p>
        </div>
      )}
    </div>
  );
}
