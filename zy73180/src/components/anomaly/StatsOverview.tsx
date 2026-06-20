import { useAppStore } from '@/store/appStore';
import { getAnomalyStats } from '@/engine/anomalyDetector';
import { AnomalyTypeTag } from './AnomalyTags';
import type { AnomalyType } from '@/types';
import { ListChecks, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

export default function StatsOverview() {
  const currentRun = useAppStore(s => s.currentRun);

  if (!currentRun) {
    return (
      <div className="card p-6 text-center text-ink-400 text-sm">
        暂无验算数据，请先运行验算
      </div>
    );
  }

  const stats = getAnomalyStats(currentRun);
  const pendingCount = stats.byStatus.pending;

  const cards = [
    {
      label: '总记录数',
      value: stats.total,
      icon: ListChecks,
      color: 'text-ink-600',
      bg: 'bg-ink-50',
    },
    {
      label: '异常记录',
      value: stats.anomalyCount,
      icon: AlertTriangle,
      color: 'text-anomaly-unit',
      bg: 'bg-red-50',
      sub: `${((stats.anomalyCount / stats.total) * 100).toFixed(1)}%`,
    },
    {
      label: '待处理',
      value: pendingCount,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '正常通过',
      value: stats.normalCount,
      icon: CheckCircle2,
      color: 'text-anomaly-normal',
      bg: 'bg-emerald-50',
    },
  ];

  const typeOrder: AnomalyType[] = ['unit_missing', 'boundary_sample', 'bad_data', 'calculation_error'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-ink-400 mb-1">{card.label}</div>
                  <div className={`text-2xl font-serif font-bold ${card.color}`}>
                    {card.value}
                    {card.sub && (
                      <span className="text-xs font-sans font-normal ml-1 text-ink-400">
                        {card.sub}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-md ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <div className="text-xs text-ink-400 mb-2.5 font-medium">异常类型分布</div>
        <div className="flex flex-wrap gap-2">
          {typeOrder.map(type => (
            <AnomalyTypeTag key={type} type={type} count={stats.byType[type]} />
          ))}
        </div>
        <div className="mt-3 h-2 bg-ink-100 rounded-full overflow-hidden flex">
          {typeOrder.map(type => {
            const count = stats.byType[type];
            if (count === 0) return null;
            const width = (count / stats.anomalyCount) * 100;
            const colors: Record<AnomalyType, string> = {
              unit_missing: 'bg-anomaly-unit',
              boundary_sample: 'bg-anomaly-boundary',
              bad_data: 'bg-anomaly-bad',
              calculation_error: 'bg-anomaly-calc',
            };
            return (
              <div
                key={type}
                className={colors[type]}
                style={{ width: `${width}%` }}
                title={`${ANOMALY_TYPE_LABELS_SHORT[type]}: ${count}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ANOMALY_TYPE_LABELS_SHORT: Record<AnomalyType, string> = {
  unit_missing: '单位缺失',
  boundary_sample: '边界样本',
  bad_data: '坏数据',
  calculation_error: '计算异常',
};
