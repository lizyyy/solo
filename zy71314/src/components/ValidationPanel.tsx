import { AlertCircle, AlertTriangle, Info, XCircle, CheckCircle2 } from 'lucide-react';
import { usePendulumStore } from '@/store/usePendulumStore';
import { getErrorCount, getWarningCount, getConflictCount } from '@/utils/validation';
import type { FlagType } from '@/types';

const flagConfig: Record<FlagType, {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}> = {
  error: {
    icon: <XCircle className="w-4 h-4" />,
    label: '错误',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: '警告',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
  conflict: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: '冲突',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/30',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    label: '提示',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
  },
};

export default function ValidationPanel() {
  const { data } = usePendulumStore();

  const errorCount = getErrorCount(data);
  const warningCount = getWarningCount(data);
  const conflictCount = getConflictCount(data);

  const allFlags = data.flatMap((d) =>
    d.flags.map((flag) => ({
      ...flag,
      dataId: d.id,
      dataIndex: data.findIndex((item) => item.id === d.id) + 1,
    }))
  );

  const groupedFlags = {
    error: allFlags.filter((f) => f.type === 'error'),
    warning: allFlags.filter((f) => f.type === 'warning'),
    conflict: allFlags.filter((f) => f.type === 'conflict'),
    info: allFlags.filter((f) => f.type === 'info'),
  };

  if (data.length === 0) {
    return null;
  }

  const totalIssues = errorCount + warningCount + conflictCount;

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          数据校验
        </h2>
        {totalIssues === 0 ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">全部正常</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {errorCount > 0 && (
              <span className="text-red-400 text-sm font-medium">
                {errorCount} 错误
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-amber-400 text-sm font-medium">
                {warningCount} 警告
              </span>
            )}
            {conflictCount > 0 && (
              <span className="text-purple-400 text-sm font-medium">
                {conflictCount} 冲突
              </span>
            )}
          </div>
        )}
      </div>

      {totalIssues === 0 ? (
        <div className="text-center py-6 text-slate-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-400/50" />
          <p>所有数据通过校验，状态良好</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
          {(['error', 'warning', 'conflict'] as FlagType[]).map((type) => {
            const flags = groupedFlags[type];
            if (flags.length === 0) return null;
            const config = flagConfig[type];

            return (
              <div key={type} className="space-y-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} border`}>
                  <span className={config.color}>{config.icon}</span>
                  <span className={`text-sm font-medium ${config.color}`}>
                    {config.label} ({flags.length})
                  </span>
                </div>
                <div className="space-y-2 ml-2">
                  {flags.map((flag, index) => (
                    <div
                      key={index}
                      className="p-3 bg-slate-700/30 rounded-lg border-l-2 border-slate-600"
                      style={{ borderLeftColor: type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#a855f7' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <span className="text-xs text-slate-500">#{flag.dataIndex}</span>
                          <p className="text-sm text-slate-300 mt-1">{flag.message}</p>
                          {flag.suggestion && (
                            <p className="text-xs text-slate-400 mt-1">
                              💡 {flag.suggestion}
                            </p>
                          )}
                        </div>
                        {flag.field && (
                          <span className="text-xs px-2 py-1 bg-slate-600/50 rounded text-slate-400">
                            {flag.field}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {errorCount > 0 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">
            ⚠️ 存在错误的数据将被排除在计算之外，请修正后再进行计算
          </p>
        </div>
      )}
    </div>
  );
}
