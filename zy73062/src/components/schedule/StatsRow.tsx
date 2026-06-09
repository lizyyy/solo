import { useMemo } from 'react';
import { List, CheckCircle2, AlertTriangle, XCircle, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScheduleStore } from '@/store/useScheduleStore';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}

function StatCard({ icon, label, value, iconBg, iconColor, valueColor }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-card border border-slate-100">
      <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="flex flex-col">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={cn('text-2xl font-bold tabular-nums', valueColor ?? 'text-slate-900')}>{value}</span>
      </div>
    </div>
  );
}

export default function StatsRow() {
  const { aggregates, evidences } = useScheduleStore((state) => ({
    aggregates: state.aggregates(),
    evidences: state.evidences,
  }));

  const stats = useMemo(() => {
    const countByStatus = { confirmed: 0, pending: 0, withdrawn: 0, draft: 0 };
    let withdrawnAggCount = 0;

    for (const agg of aggregates) {
      const status = agg.latest.status;
      if (status in countByStatus) {
        countByStatus[status as keyof typeof countByStatus]++;
      }
      if (agg.withdrawnCount > 0) {
        withdrawnAggCount++;
      }
    }

    const bizKeysWithPendingEvidence = new Set<string>();
    for (const ev of evidences) {
      if (!ev.confirmed) {
        bizKeysWithPendingEvidence.add(ev.location);
      }
    }

    return {
      total: aggregates.length,
      countByStatus,
      withdrawnAggCount,
      pendingEvidenceCount: bizKeysWithPendingEvidence.size,
    };
  }, [aggregates, evidences]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        icon={<List size={22} strokeWidth={2} />}
        label="总条数"
        value={stats.total}
        iconBg="bg-slate-100"
        iconColor="text-slate-700"
      />
      <StatCard
        icon={<CheckCircle2 size={22} strokeWidth={2} />}
        label="已确认"
        value={stats.countByStatus.confirmed}
        iconBg="bg-green-50"
        iconColor="text-green-600"
        valueColor="text-green-700"
      />
      <StatCard
        icon={<AlertTriangle size={22} strokeWidth={2} />}
        label="待确认"
        value={stats.countByStatus.pending}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
        valueColor="text-amber-700"
      />
      <StatCard
        icon={<XCircle size={22} strokeWidth={2} />}
        label="已撤回"
        value={stats.withdrawnAggCount}
        iconBg="bg-gray-100"
        iconColor="text-gray-600"
        valueColor="text-gray-700"
      />
      <StatCard
        icon={<FileWarning size={22} strokeWidth={2} />}
        label="待补证据"
        value={stats.pendingEvidenceCount}
        iconBg="bg-rose-50"
        iconColor="text-rose-600"
        valueColor="text-rose-700"
      />
    </div>
  );
}
