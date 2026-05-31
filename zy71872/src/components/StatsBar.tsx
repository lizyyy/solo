import { Activity, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';

export function StatsBar() {
  const { getStats, anomalies, snapshots, validateIntegrity } = useSimulationStore();
  const stats = getStats();
  const unhandledAnomalies = anomalies.filter((a) => !a.handled).length;
  const isValid = validateIntegrity();

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  };

  const statItems = [
    {
      label: '排队中',
      value: stats.totalQueued,
      icon: Clock,
      color: 'text-slate-400',
    },
    {
      label: '处理中',
      value: stats.totalProcessing,
      icon: Activity,
      color: 'text-amber-400',
    },
    {
      label: '已完成',
      value: stats.totalCompleted,
      icon: CheckCircle,
      color: 'text-emerald-400',
    },
    {
      label: '失败',
      value: stats.totalFailed,
      icon: XCircle,
      color: 'text-red-400',
    },
    {
      label: '未处理异常',
      value: unhandledAnomalies,
      icon: AlertTriangle,
      color: unhandledAnomalies > 0 ? 'text-red-400' : 'text-slate-400',
    },
  ];

  return (
    <div className="panel mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-6">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center space-x-2">
                <Icon className={`w-4 h-4 ${item.color}`} />
                <div>
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className={`font-mono text-lg font-semibold ${item.color}`}>
                    {item.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center space-x-4 text-sm">
          <div className="text-right">
            <div className="text-xs text-slate-500">平均队列长度</div>
            <div className="font-mono text-slate-300">{stats.avgQueueLength.toFixed(1)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">状态快照</div>
            <div className="font-mono text-slate-300">{snapshots.length}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">数据完整性</div>
            <div className={`font-mono ${isValid ? 'text-emerald-400' : 'text-red-400'}`}>
              {isValid ? '✓ 有效' : '✗ 已篡改'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
