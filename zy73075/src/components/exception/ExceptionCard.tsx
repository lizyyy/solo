import { useWorkorderStore } from '@/store/workorderStore';
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/constants/enums';
import { cn } from '@/lib/utils';
import type { RecallRecord, ProcessStatus } from '@/types';

interface ExceptionCardProps {
  recall: RecallRecord;
}

const PROCESS_BUTTONS: { status: ProcessStatus; label: string; className: string }[] = [
  { status: '处理中', label: '标记处理中', className: 'btn-ghost' },
  { status: '已修正', label: '标记已修正', className: 'btn-primary' },
  { status: '需人工确认', label: '需人工确认', className: 'btn-danger' },
];

export default function ExceptionCard({ recall }: ExceptionCardProps) {
  const updateRecall = useWorkorderStore(s => s.updateRecall);
  const workorders = useWorkorderStore(s => s.workorders);
  const workorder = workorders.find(w => w.id === recall.workorder_id);

  const handleStatusChange = (status: ProcessStatus) => {
    updateRecall(recall.id, { process_status: status });
  };

  const toggleSafetyConfirmed = () => {
    updateRecall(recall.id, { safety_confirmed: !recall.safety_confirmed });
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('badge', CATEGORY_COLOR[recall.category])}>
            <span>{CATEGORY_EMOJI[recall.category]}</span>
            <span>{recall.category}</span>
          </span>
          <span className="text-sm text-slate-400">
            关联工单：
            <span className="text-slate-200 font-mono">
              {workorder?.id ?? recall.workorder_id}
            </span>
          </span>
        </div>
        <span className={cn(
          'badge border',
          recall.process_status === '待处理' && 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          recall.process_status === '处理中' && 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          recall.process_status === '已修正' && 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          recall.process_status === '需人工确认' && 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        )}>
          {recall.process_status}
        </span>
      </div>

      {recall.detail && (
        <p className="text-sm text-slate-300 mb-3">{recall.detail}</p>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 p-3">
          <div className="text-xs text-rose-400 mb-1">原始值</div>
          <div className="text-sm text-rose-300 line-through break-all">
            {recall.original_value || '-'}
          </div>
        </div>
        <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="text-xs text-emerald-400 mb-1">正确值</div>
          <div className="text-sm text-emerald-300 underline underline-offset-2 break-all">
            {recall.correct_example || '-'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-700/70">
        {PROCESS_BUTTONS.map(btn => (
          <button
            key={btn.status}
            onClick={() => handleStatusChange(btn.status)}
            disabled={recall.process_status === btn.status}
            className={cn(btn.className)}
          >
            {btn.label}
          </button>
        ))}
        <div className="ml-auto">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
            <input
              type="checkbox"
              checked={recall.safety_confirmed}
              onChange={toggleSafetyConfirmed}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-shield-500 focus:ring-shield-400 focus:ring-offset-slate-900"
            />
            安全员确认
          </label>
        </div>
      </div>
    </div>
  );
}
