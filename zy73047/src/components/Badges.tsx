import type { ScheduleConclusion, HandoffStatus, LogStatus, AnomalyType } from '@/types';
import { conclusionMeta, handoffMeta, anomalyTypeLabel, cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, CheckCircle2, Clock, Gauge } from 'lucide-react';

export const ConclusionBadge = ({ value }: { value: ScheduleConclusion }) => {
  const m = conclusionMeta[value];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium',
        m.cls
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
};

export const HandoffBadge = ({ value }: { value: HandoffStatus }) => {
  const m = handoffMeta[value];
  const Icon =
    value === 'releasable'
      ? CheckCircle2
      : value === 'missing_material'
      ? AlertTriangle
      : Clock;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium',
        m.bg,
        m.cls
      )}
    >
      <Icon size={12} />
      {m.label}
    </span>
  );
};

export const LogStatusBadge = ({
  status,
  type,
}: {
  status: LogStatus;
  type?: AnomalyType;
}) => {
  if (status === 'normal') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        正常
      </span>
    );
  }
  if (status === 'gap') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-medium">
        <AlertTriangle size={12} />
        断档
        {type && <span className="opacity-70">·{anomalyTypeLabel[type] ?? type}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium">
      <AlertCircle size={12} />
      异常
      {type && <span className="opacity-70">·{anomalyTypeLabel[type] ?? type}</span>}
    </span>
  );
};

export const StatCard = ({
  label,
  value,
  accent,
  Icon,
  sub,
  onClick,
}: {
  label: string;
  value: string | number;
  accent: 'emerald' | 'red' | 'amber' | 'slate' | 'blue';
  Icon: any;
  sub?: string;
  onClick?: () => void;
}) => {
  const acc = {
    emerald: 'from-emerald-500 to-emerald-600 text-emerald-600 bg-emerald-50 border-emerald-200',
    red: 'from-red-500 to-red-600 text-red-600 bg-red-50 border-red-200',
    amber: 'from-amber-500 to-amber-600 text-amber-700 bg-amber-50 border-amber-300',
    slate: 'from-slate-500 to-slate-600 text-slate-600 bg-slate-100 border-slate-200',
    blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50 border-blue-200',
  }[accent];
  const [from, to, textCls, bgCls, borderCls] = acc.split(' ');
  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left w-full bg-white border rounded-lg p-4 hover:shadow-md transition-all',
        borderCls
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500 mb-1">{label}</div>
          <div className="text-3xl font-bold tracking-tight text-slate-800 tabular-nums">
            {value}
          </div>
          {sub && <div className="text-xs mt-1 text-slate-500">{sub}</div>}
        </div>
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br',
            from,
            to,
            'text-white shadow-sm group-hover:scale-105 transition-transform'
          )}
        >
          {Icon ? <Icon size={20} /> : <Gauge size={20} />}
        </div>
      </div>
    </button>
  );
};
