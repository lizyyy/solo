import type { ReviewRecord } from '@/types';
import { useReviewStore } from '@/store/reviewStore';
import { StatusBadge, ChangeTypeBadge } from './Badges';
import { ChevronRight, Clock, User, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

export function RecordCard({ record }: { record: ReviewRecord }) {
  const { setActiveRecordId, statusFilter } = useReviewStore();
  const primaryChange = record.changeLogs[0];

  return (
    <div
      onClick={() => setActiveRecordId(record.id)}
      className={clsx(
        'group bg-white rounded border cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden',
        record.status === 'confirmed' && 'border-emerald-300 border-l-4 border-l-emerald-500',
        record.status === 'pending' && 'border-amber-300 border-l-4 border-l-amber-500',
        record.status === 'rejected' && 'border-red-300 border-l-4 border-l-red-500',
        statusFilter === 'all' && 'border-zinc-300'
      )}
    >
      <div className="p-4 flex gap-4">
        <div className="w-20 shrink-0 flex flex-col justify-between py-1 pr-4 border-r border-zinc-200">
          <div className="font-mono text-[11px] font-bold text-blue-800 tracking-tight leading-tight break-all">
            {record.id}
          </div>
          <div className="mt-2 font-mono text-sm font-bold text-zinc-900 bg-zinc-100 rounded px-2 py-1 inline-block w-fit">
            {record.elevatorId}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge status={record.status} />
            {primaryChange ? (
              <ChangeTypeBadge type={primaryChange.changeType} />
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-300">
                <CheckCircle2 className="w-3 h-3" /> 无变更
              </span>
            )}
            {record.changeLogs.length > 1 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-white font-mono">
                +{record.changeLogs.length - 1} 变更
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-zinc-800 line-clamp-2 mb-2 flex items-start gap-1.5">
            {record.changeLogs.some((c) => c.changeType === 'threshold') && (
              <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            )}
            <span>{record.summary}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-2">
            <span className="inline-flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              <span className="text-zinc-600 font-medium">{record.faultType}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              {record.handler}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {record.handledAt.slice(5, 16)}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-400 group-hover:bg-blue-50 group-hover:border-blue-400 group-hover:text-blue-600 transition-colors">
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
