import { cn } from '@/lib/utils';
import type { MaterialStatus, JudgeResult, OpinionSource } from '@/shared/types';

interface StatusBadgeProps {
  status?: MaterialStatus;
  judgeResult?: JudgeResult | null;
  source?: OpinionSource;
  className?: string;
}

const statusConfig: Record<MaterialStatus, { label: string; className: string }> = {
  PROCESSED: {
    label: '已处理',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  PENDING: {
    label: '待改判',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  SUSPENDED: {
    label: '批次挂起',
    className: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  MISSING: {
    label: '缺材料',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  AWAITING_PM: {
    label: '待PM确认',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
};

const judgeResultConfig: Record<JudgeResult, { label: string; className: string }> = {
  PASS: {
    label: '通过',
    className: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  FAIL: {
    label: '不通过',
    className: 'bg-rose-50 text-rose-600 border-rose-200',
  },
  CONDITIONAL_PASS: {
    label: '条件通过',
    className: 'bg-sky-50 text-sky-600 border-sky-200',
  },
  NEED_REVIEW: {
    label: '需复核',
    className: 'bg-purple-50 text-purple-600 border-purple-200',
  },
};

const sourceConfig: Record<OpinionSource, { label: string; className: string }> = {
  HANDOVER_LIST: {
    label: '交底清单',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  SUBMISSION_FORM: {
    label: '送审表',
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  OLD_PROCESS: {
    label: '旧处理',
    className: 'bg-slate-200 text-slate-600 border-slate-300',
  },
  SUPPLEMENT_NOTE: {
    label: '后补备注',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  LATEST_EXPORT: {
    label: '最新导出',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
};

export default function StatusBadge({ status, judgeResult, source, className }: StatusBadgeProps) {
  let config: { label: string; className: string } | null = null;

  if (status && statusConfig[status]) {
    config = statusConfig[status];
  } else if (judgeResult && judgeResultConfig[judgeResult]) {
    config = judgeResultConfig[judgeResult];
  } else if (source && sourceConfig[source]) {
    config = sourceConfig[source];
  }

  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
