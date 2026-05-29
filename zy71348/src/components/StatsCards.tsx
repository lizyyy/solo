import { useRecordStore } from '@/store/useRecordStore';
import { Disc, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';

export function StatsCards() {
  const records = useRecordStore((s) => s.records);
  const unresolvedExceptions = useRecordStore((s) =>
    s.getUnresolvedExceptions()
  );

  const totalCount = records.length;
  const exceptionCount = unresolvedExceptions.length;
  const verifiedCount = records.filter((r) => r.status === 'verified').length;
  const todayCount = records.filter((r) => {
    const today = new Date().toISOString().slice(0, 10);
    return r.createdAt.slice(0, 10) === today;
  }).length;

  const cards = [
    {
      label: '库存总数',
      value: totalCount,
      icon: Disc,
      color: 'text-vinyl-700',
      bg: 'bg-vinyl-700/10',
    },
    {
      label: '待处理异常',
      value: exceptionCount,
      icon: AlertTriangle,
      color: exceptionCount > 0 ? 'text-alert-500' : 'text-gray-500',
      bg: exceptionCount > 0 ? 'bg-alert-500/10' : 'bg-gray-100',
    },
    {
      label: '待上架',
      value: verifiedCount,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      label: '今日新增',
      value: todayCount,
      icon: Plus,
      color: 'text-caramel-500',
      bg: 'bg-caramel-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="card flex items-center gap-4 animate-fade-in">
          <div className={`p-3 rounded-sm ${card.bg}`}>
            <card.icon className={`w-6 h-6 ${card.color}`} />
          </div>
          <div>
            <p className="text-sm text-vinyl-600">{card.label}</p>
            <p className={`text-2xl font-bold font-display ${card.color}`}>
              {card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
