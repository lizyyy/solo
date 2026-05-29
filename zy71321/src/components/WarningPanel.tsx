import { useSimulationStore } from '../store/simulationStore';
import { BoundaryWarning } from '../types';

function WarningItem({ warning }: { warning: BoundaryWarning }) {
  const confirmWarning = useSimulationStore((state) => state.confirmWarning);
  
  const severityConfig = {
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-700',
      badge: 'bg-amber-500',
      icon: '⚠️',
    },
    to_confirm: {
      bg: 'bg-orange-50',
      border: 'border-orange-400',
      text: 'text-orange-700',
      badge: 'bg-orange-500 animate-pulse-warning',
      icon: '🔍',
    },
  };

  const typeLabels: Record<string, string> = {
    zero_turns: '匝数为零',
    reverse_direction: '方向反向',
    curve_truncated: '曲线截断',
    extreme_value: '极值参数',
  };

  const config = severityConfig[warning.severity];

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-lg p-3 mb-2 ${
        warning.confirmed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs ${config.badge} text-white px-2 py-0.5 rounded`}>
              {warning.severity === 'to_confirm' ? '待确认' : '警告'}
            </span>
            <span className={`text-xs font-medium ${config.text}`}>
              {typeLabels[warning.type]}
            </span>
            {warning.confirmed && (
              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                ✓ 已确认
              </span>
            )}
          </div>
          <p className={`text-sm ${config.text}`}>{warning.message}</p>
        </div>
        {!warning.confirmed && warning.severity === 'to_confirm' && (
          <button
            onClick={() => confirmWarning(warning.id)}
            className="text-xs bg-white border border-orange-300 text-orange-600 px-2 py-1 rounded hover:bg-orange-50 btn-hover flex-shrink-0"
          >
            确认
          </button>
        )}
      </div>
    </div>
  );
}

export function WarningPanel() {
  const warnings = useSimulationStore((state) => state.session.warnings);
  const unconfirmedCount = warnings.filter((w) => !w.confirmed).length;

  if (warnings.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-700">
          <span className="text-lg">✓</span>
          <span className="text-sm font-medium">参数状态正常</span>
        </div>
        <p className="text-xs text-green-600 mt-1 ml-6">
          所有参数在合理范围内，无边界异常
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          边界检测
          {unconfirmedCount > 0 && (
            <span className="bg-danger-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unconfirmedCount} 待确认
            </span>
          )}
        </h3>
      </div>
      {warnings.map((warning) => (
        <WarningItem key={warning.id} warning={warning} />
      ))}
    </div>
  );
}
