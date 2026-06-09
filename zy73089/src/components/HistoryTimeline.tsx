import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  RefreshCw,
  FileDown,
  FilePlus2,
  MessageSquarePlus,
  GitBranch,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import type { HistoryEvent } from '@/shared/types';

const EVENT_ICONS: Record<HistoryEvent['eventType'], React.ElementType> = {
  batch_created: FilePlus2,
  batch_run: PlayCircle,
  batch_rerun: RefreshCw,
  snapshot_created: FileDown,
  remark_added: MessageSquarePlus,
};

const EVENT_COLORS: Record<HistoryEvent['eventType'], string> = {
  batch_created: 'bg-blue-500',
  batch_run: 'bg-emerald-500',
  batch_rerun: 'bg-indigo-500',
  snapshot_created: 'bg-amber-500',
  remark_added: 'bg-sky-500',
};

const EVENT_LABEL: Record<HistoryEvent['eventType'], string> = {
  batch_created: '批次创建',
  batch_run: '执行比对',
  batch_rerun: '补备注重跑',
  snapshot_created: '导出快照',
  remark_added: '追加备注',
};

interface Props {
  compact?: boolean;
}

export function HistoryTimeline({ compact }: Props) {
  const nav = useNavigate();
  const events = useChecklistStore((s) => s.historyEvents);
  const batches = useChecklistStore((s) => s.batches);
  const snapshots = useChecklistStore((s) => s.snapshots);

  const sorted = useMemo(
    () => events.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [events],
  );

  const list = compact ? sorted.slice(0, 10) : sorted;

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center text-xs text-slate-400 italic">
        <Calendar className="mx-auto mb-2 h-8 w-8 opacity-60" />
        暂无历史记录。去样例页一键载入样例数据，即可生成完整流程时间线。
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-300 via-slate-200 to-transparent" />

      <ul className="space-y-3">
        {list.map((evt, idx) => {
          const Icon = EVENT_ICONS[evt.eventType] || Calendar;
          const batch = batches[evt.batchId];
          const snap = evt.eventType === 'snapshot_created'
            ? Object.values(snapshots).find((s) => s.createdAt === evt.timestamp)
            : null;
          const dt = new Date(evt.timestamp);
          return (
            <li
              key={evt.eventId + idx}
              className="relative pl-10"
            >
              <div
                className={`absolute left-1 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md text-white ${EVENT_COLORS[evt.eventType]}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              <button
                onClick={() => nav(`/checklist/${evt.batchId}`)}
                className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {EVENT_LABEL[evt.eventType]}
                    </span>
                    {evt.eventType === 'batch_rerun' && (
                      <span className="flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                        <GitBranch className="h-2.5 w-2.5" /> 重跑链
                      </span>
                    )}
                    {snap && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        {snap.exportFormat}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    {dt.toLocaleString('zh-CN', { hour12: false })}
                  </span>
                </div>

                <div className="text-xs text-slate-800">{evt.description}</div>

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[10.5px] text-slate-500">
                    批次 {evt.batchId}
                    {batch && (
                      <span className="ml-1 text-slate-600">· {batch.name}</span>
                    )}
                  </div>
                  <span className="flex items-center gap-0.5 text-[10.5px] text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                    打开批次 <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
