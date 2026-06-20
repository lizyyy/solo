import { useWorkorderStore } from '@/store/workorderStore';
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/constants/enums';
import { cn } from '@/lib/utils';
import type { ExceptionCategory, ProcessStatus } from '@/types';

interface RecallTimelineProps {
  workorderId: string;
}

const DOT_COLOR: Record<ExceptionCategory, string> = {
  公式问题: 'bg-rose-500',
  单位问题: 'bg-orange-500',
  阈值问题: 'bg-violet-500',
  数据缺失: 'bg-yellow-500',
};

const PROCESS_STATUS_COLOR: Record<ProcessStatus, string> = {
  待处理: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  处理中: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  已修正: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  需人工确认: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function RecallTimeline({ workorderId }: RecallTimelineProps) {
  const getRecallsByWorkorder = useWorkorderStore(s => s.getRecallsByWorkorder);
  const records = getRecallsByWorkorder(workorderId).sort(
    (a, b) => new Date(b.recall_time).getTime() - new Date(a.recall_time).getTime(),
  );

  if (records.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        暂无撤回记录
      </div>
    );
  }

  return (
    <div className="relative">
      {records.map((record, idx) => (
        <div key={record.id} className="relative flex gap-4 pb-6 last:pb-0">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-3 h-3 rounded-full mt-1.5 shrink-0 ring-4 ring-slate-900',
                DOT_COLOR[record.category],
              )}
            />
            {idx < records.length - 1 && (
              <div className="w-px flex-1 bg-slate-700/70 mt-2" />
            )}
          </div>

          <div className="flex-1 card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className={cn('badge', CATEGORY_COLOR[record.category])}>
                  <span>{CATEGORY_EMOJI[record.category]}</span>
                  <span>{record.category}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {formatTime(record.recall_time)}
                </span>
              </div>
              <span className={cn('badge border', PROCESS_STATUS_COLOR[record.process_status])}>
                {record.process_status}
              </span>
            </div>

            {record.detail && (
              <p className="text-sm text-slate-300 mb-3">{record.detail}</p>
            )}

            {(record.original_value || record.correct_example) && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 p-2">
                  <div className="text-xs text-rose-400 mb-1">原始值</div>
                  <div className="text-sm text-rose-300 line-through break-all">
                    {record.original_value || '-'}
                  </div>
                </div>
                <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-2">
                  <div className="text-xs text-emerald-400 mb-1">正确示例</div>
                  <div className="text-sm text-emerald-300 underline underline-offset-2 break-all">
                    {record.correct_example || '-'}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={record.safety_confirmed}
                  readOnly
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-shield-500 focus:ring-shield-400 focus:ring-offset-slate-900"
                />
                安全员已确认
              </label>
              {record.process_remark && (
                <span className="text-slate-400">
                  处理备注：{record.process_remark}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
