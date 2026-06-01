import { useDataStore } from '@/store/useDataStore';
import { AlertCircle, AlertTriangle, Info, CheckCircle, ClipboardList } from 'lucide-react';

const levelConfig = {
  danger: {
    icon: AlertCircle,
    border: 'border-red-500/50',
    bg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    titleColor: 'text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-300',
  },
  info: {
    icon: Info,
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-300',
  },
};

export function RecommendationsCard() {
  const { recommendations, records, setSelectedRecordId } = useDataStore();

  if (recommendations.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-slate-200">处理建议</h3>
        </div>
        <div className="text-center py-12 text-slate-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400/50" />
          <p>数据状态良好，暂无特殊处理建议</p>
        </div>
      </div>
    );
  }

  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const order = { danger: 0, warning: 1, info: 2 };
    return order[a.level] - order[b.level];
  });

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-400" />
          处理建议
          <span className="text-sm font-normal text-slate-400">
            （{recommendations.length} 条）
          </span>
        </h3>
        <div className="text-xs text-slate-500">
          业务同事可直接照着操作
        </div>
      </div>

      <div className="space-y-4">
        {sortedRecommendations.map((rec, index) => {
          const config = levelConfig[rec.level];
          const Icon = config.icon;

          return (
            <div
              key={index}
              className={`border ${config.border} ${config.bg} rounded-xl p-5`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 rounded-lg ${config.bg} ${config.border} border`}>
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${config.titleColor}`}>
                    {rec.title}
                  </h4>
                  <p className="text-sm text-slate-400 mt-1">
                    {rec.description}
                  </p>
                </div>
                {rec.relatedRecordIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rec.relatedRecordIds.slice(0, 3).map((id) => (
                      <button
                        key={id}
                        onClick={() => setSelectedRecordId(id)}
                        className="px-2 py-0.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                      >
                        {id}
                      </button>
                    ))}
                    {rec.relatedRecordIds.length > 3 && (
                      <span className="px-2 py-0.5 text-xs text-slate-500">
                        +{rec.relatedRecordIds.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
                  操作步骤
                </div>
                <div className="space-y-1.5">
                  {rec.action.split('\n').map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-slate-500 font-mono">{line.split('.')[0]}.</span>
                      <span>{line.split('.').slice(1).join('.').trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
