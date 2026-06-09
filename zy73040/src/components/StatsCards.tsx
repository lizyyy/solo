import { AlertTriangle, Clock, ShieldBan, FileWarning } from 'lucide-react';
import { usePlaybackStore } from '@/store/usePlaybackStore';

export default function StatsCards() {
  const stats = usePlaybackStore((s) => s.statistics);
  const selectOrder = usePlaybackStore((s) => s.selectOrder);
  const workOrders = usePlaybackStore((s) => s.workOrders);
  const abnormalIds = workOrders.filter((o) => o.status === 'abnormal').map((o) => o.id);

  const jumpToFirstAbnormal = () => {
    if (abnormalIds.length > 0) selectOrder(abnormalIds[0]);
  };

  const cards = [
    {
      label: '总异常数',
      value: stats.totalAbnormal,
      icon: AlertTriangle,
      color: 'coral',
      bg: 'bg-coral-50',
      iconBg: 'bg-coral-400 text-white',
      text: 'text-coral-500',
      valueText: 'text-coral-600',
      pulse: stats.totalAbnormal > 0,
      onClick: jumpToFirstAbnormal,
    },
    {
      label: '到货延误',
      value: stats.delayedArrival,
      icon: Clock,
      color: 'orange',
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-400 text-white',
      text: 'text-amber-500',
      valueText: 'text-amber-600',
      pulse: false,
    },
    {
      label: '型号替换拦截',
      value: stats.replacementBlocked,
      icon: ShieldBan,
      color: 'navy',
      bg: 'bg-navy-50',
      iconBg: 'bg-navy-500 text-white',
      text: 'text-navy-500',
      valueText: 'text-navy-600',
      pulse: false,
    },
    {
      label: '待补证据',
      value: stats.pendingEvidences,
      icon: FileWarning,
      color: 'amber',
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-400 text-white',
      text: 'text-amber-500',
      valueText: 'text-amber-600',
      pulse: stats.pendingEvidences > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            onClick={c.onClick}
            className={`card p-5 relative overflow-hidden ${c.onClick ? 'cursor-pointer transition-all hover:shadow-card-hover' : ''}`}
          >
            <div className={`absolute -right-4 -top-4 w-24 h-24 ${c.bg} rounded-full opacity-50`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-md ${c.iconBg} flex items-center justify-center shadow-inner`}>
                  <Icon className={`w-5 h-5 ${c.pulse ? 'animate-pulse-soft' : ''}`} strokeWidth={2.2} />
                </div>
                {c.pulse && (
                  <span className="flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full ${c.bg.replace('bg-', 'bg-').replace('-50', '-400')} opacity-75`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${c.bg.replace('bg-', 'bg-').replace('-50', '-400')}`} />
                  </span>
                )}
              </div>
              <div className={`mt-4 text-4xl font-black ${c.valueText} tracking-tight`}>{c.value}</div>
              <div className={`mt-1 text-xs font-medium ${c.text} uppercase tracking-wider`}>{c.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
