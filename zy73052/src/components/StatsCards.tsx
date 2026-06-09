import type { ResultBundle, AnomalyInfo } from '../types';

interface Props {
  bundle: ResultBundle;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  total: { label: '记录总数', cls: 'stat-total' },
  normal: { label: '正常', cls: 'stat-normal' },
  warning: { label: '预警', cls: 'stat-warning' },
  critical: { label: '超限', cls: 'stat-critical' },
  missing: { label: '断档', cls: 'stat-missing' },
  anomalyTotal: { label: '异常检出', cls: 'stat-anomaly' },
};

export default function StatsCards({ bundle }: Props) {
  const keys: Array<keyof ResultBundle['stats']> = [
    'total',
    'normal',
    'warning',
    'critical',
    'missing',
    'anomalyTotal',
  ];
  return (
    <section className="stats-grid">
      {keys.map((k) => (
        <div key={k} className={`stat-card ${STATUS_META[k].cls}`}>
          <div className="stat-num">{bundle.stats[k]}</div>
          <div className="stat-label">{STATUS_META[k].label}</div>
        </div>
      ))}
    </section>
  );
}
