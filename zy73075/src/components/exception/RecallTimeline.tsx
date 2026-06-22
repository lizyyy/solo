import { useState } from 'react';
import { useWorkorderStore } from '@/store/workorderStore';
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/constants/enums';
import { cn } from '@/lib/utils';
import type { ExceptionCategory, ProcessStatus, RecallRecord } from '@/types';

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

const PROCESS_BUTTONS: {
  status: ProcessStatus;
  label: string;
  className: string;
  defaultRemark: string;
}[] = [
  { status: '待处理', label: '待处理', className: 'btn-ghost', defaultRemark: '重置为待处理' },
  { status: '处理中', label: '处理中', className: 'btn-ghost', defaultRemark: '已定位问题，正在处理' },
  { status: '已修正', label: '已修正', className: 'btn-primary', defaultRemark: '按正确示例修改完成' },
  { status: '需人工确认', label: '转人工', className: 'btn-danger', defaultRemark: '超出权限，转项目经理介入' },
];

const DEFAULT_HANDLER_BY = '安全员·老唐';
const DEFAULT_REVIEW_BY = '安全员·老唐';

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function TimelineItem({ record }: { record: RecallRecord }) {
  const updateRecall = useWorkorderStore(s => s.updateRecall);
  const [remark, setRemark] = useState(record.process_remark || '');

  const handleStatus = (status: ProcessStatus, defaultRemark: string) => {
    const now = new Date().toISOString();
    updateRecall(record.id, {
      process_status: status,
      process_remark: remark.trim() || defaultRemark,
      process_by: DEFAULT_HANDLER_BY,
      process_time: now,
    });
  };

  const toggleConfirm = () => {
    const now = new Date().toISOString();
    const next = !record.safety_confirmed;
    updateRecall(record.id, {
      safety_confirmed: next,
      safety_by: next ? DEFAULT_REVIEW_BY : '',
      safety_time: next ? now : '',
    });
  };

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-3 h-3 rounded-full mt-1.5 shrink-0 ring-4 ring-slate-900',
            DOT_COLOR[record.category],
          )}
        />
      </div>

      <div className="flex-1 card p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('badge', CATEGORY_COLOR[record.category])}>
              <span>{CATEGORY_EMOJI[record.category]}</span>
              <span>{record.category}</span>
            </span>
            <span className="text-xs text-slate-400">{formatTime(record.recall_time)}</span>
            <span className="text-xs text-slate-500">涉及字段：{record.fields_involved}</span>
          </div>
          <span className={cn('badge border', PROCESS_STATUS_COLOR[record.process_status])}>
            {record.process_status}
          </span>
        </div>

        {record.detail && (
          <p className="text-sm text-slate-300 mb-3 leading-relaxed">{record.detail}</p>
        )}

        {(record.original_value || record.correct_example) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {record.original_value && (
              <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 p-2">
                <div className="text-xs text-rose-400 mb-1">原始值</div>
                <div className="text-sm text-rose-300 line-through break-all">
                  {record.original_value}
                </div>
              </div>
            )}
            {record.correct_example && (
              <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-2">
                <div className="text-xs text-emerald-400 mb-1">正确示例</div>
                <div className="text-sm text-emerald-300 underline underline-offset-2 break-all">
                  {record.correct_example}
                </div>
              </div>
            )}
          </div>
        )}

        {(record.process_by || record.process_remark || record.safety_by) && (
          <div className="mb-3 p-2 bg-slate-800/60 rounded-sm text-xs space-y-1">
            {record.process_by && record.process_time && (
              <div className="text-slate-400">
                最近处理：
                <span className="text-shield-300 font-medium">{record.process_by}</span>
                <span className="text-slate-600 mx-1">·</span>
                <span>{formatTime(record.process_time)}</span>
              </div>
            )}
            {record.process_remark && (
              <div className="text-slate-400">
                处理备注：<span className="text-slate-200">{record.process_remark}</span>
              </div>
            )}
            {record.safety_by && record.safety_time && (
              <div className="text-emerald-400">
                安全员确认：
                <span className="font-medium">{record.safety_by}</span>
                <span className="text-slate-600 mx-1">·</span>
                <span>{formatTime(record.safety_time)}</span>
              </div>
            )}
          </div>
        )}

        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">处理备注</div>
          <input
            type="text"
            value={remark}
            onChange={e => setRemark(e.target.value)}
            placeholder="输入处理说明，留空则使用默认文案"
            className="w-full px-2.5 py-1.5 text-xs rounded-sm bg-slate-800 border border-slate-600
                       text-slate-200 placeholder-slate-500
                       focus:outline-none focus:border-shield-400 focus:ring-1 focus:ring-shield-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-700/50">
          {PROCESS_BUTTONS.map(btn => (
            <button
              key={btn.status}
              onClick={() => handleStatus(btn.status, btn.defaultRemark)}
              disabled={record.process_status === btn.status}
              className={cn(btn.className, '!py-1 text-xs')}
            >
              {btn.label}
            </button>
          ))}
          <div className="ml-auto">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={record.safety_confirmed}
                onChange={toggleConfirm}
                className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-shield-500 focus:ring-shield-400 focus:ring-offset-slate-900"
              />
              安全员{record.safety_confirmed ? '已确认' : '确认'}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecallTimeline({ workorderId }: RecallTimelineProps) {
  const getRecallsByWorkorder = useWorkorderStore(s => s.getRecallsByWorkorder);
  const records = getRecallsByWorkorder(workorderId).sort(
    (a, b) => new Date(b.recall_time).getTime() - new Date(a.recall_time).getTime(),
  );

  if (records.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400 text-sm">
        暂无撤回记录，所有备件均通过校验
      </div>
    );
  }

  return (
    <div className="relative">
      {records.map(record => (
        <TimelineItem key={record.id} record={record} />
      ))}
    </div>
  );
}
