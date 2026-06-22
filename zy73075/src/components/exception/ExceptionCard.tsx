import { useState } from 'react';
import { useWorkorderStore } from '@/store/workorderStore';
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/constants/enums';
import { cn } from '@/lib/utils';
import type { RecallRecord, ProcessStatus } from '@/types';

interface ExceptionCardProps {
  recall: RecallRecord;
}

const PROCESS_BUTTONS: {
  status: ProcessStatus;
  label: string;
  className: string;
  defaultRemark: string;
}[] = [
  { status: '待处理', label: '重置待处理', className: 'btn-ghost', defaultRemark: '撤回重置，等待处理人' },
  { status: '处理中', label: '标记处理中', className: 'btn-ghost', defaultRemark: '已定位问题，正在处理' },
  { status: '已修正', label: '标记已修正', className: 'btn-primary', defaultRemark: '按正确示例修改完成' },
  { status: '需人工确认', label: '需人工确认', className: 'btn-danger', defaultRemark: '超出当前权限，转项目经理介入' },
];

const DEFAULT_HANDLER_BY = '安全员·老唐';
const DEFAULT_REVIEW_BY = '安全员·老唐';

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function ExceptionCard({ recall }: ExceptionCardProps) {
  const updateRecall = useWorkorderStore(s => s.updateRecall);
  const workorders = useWorkorderStore(s => s.workorders);
  const workorder = workorders.find(w => w.id === recall.workorder_id);
  const [remarkInput, setRemarkInput] = useState<string>(recall.process_remark || '');

  const handleStatusChange = (status: ProcessStatus, defaultRemark: string) => {
    const now = new Date().toISOString();
    const remark = remarkInput.trim() || defaultRemark;
    updateRecall(recall.id, {
      process_status: status,
      process_remark: remark,
      process_by: DEFAULT_HANDLER_BY,
      process_time: now,
    });
  };

  const toggleSafetyConfirmed = () => {
    const now = new Date().toISOString();
    const next = !recall.safety_confirmed;
    updateRecall(recall.id, {
      safety_confirmed: next,
      safety_by: next ? DEFAULT_REVIEW_BY : '',
      safety_time: next ? now : '',
    });
  };

  return (
    <div className={cn('card p-4', CATEGORY_COLOR[recall.category])}>
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
        <span
          className={cn(
            'badge border',
            recall.process_status === '待处理' &&
              'bg-slate-500/20 text-slate-300 border-slate-500/40',
            recall.process_status === '处理中' &&
              'bg-blue-500/20 text-blue-300 border-blue-500/40',
            recall.process_status === '已修正' &&
              'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            recall.process_status === '需人工确认' &&
              'bg-amber-500/20 text-amber-300 border-amber-500/40',
          )}
        >
          {recall.process_status}
        </span>
      </div>

      {recall.detail && (
        <p className="text-sm text-slate-300 mb-3 leading-relaxed">{recall.detail}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 p-3">
          <div className="text-xs text-rose-400 mb-1">原始值</div>
          <div className="text-sm text-rose-300 line-through break-all">
            {recall.original_value || '-'}
          </div>
        </div>
        <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="text-xs text-emerald-400 mb-1">正确示例</div>
          <div className="text-sm text-emerald-300 underline underline-offset-2 break-all">
            {recall.correct_example || '-'}
          </div>
        </div>
      </div>

      {(recall.process_by || recall.process_time || recall.safety_by) && (
        <div className="text-xs text-slate-400 mb-3 p-2 bg-slate-800/50 rounded-sm space-y-1">
          {recall.process_by && recall.process_time && (
            <div>
              最近处理：
              <span className="text-shield-300 font-medium">{recall.process_by}</span>
              <span className="text-slate-500"> · </span>
              <span>{formatTime(recall.process_time)}</span>
            </div>
          )}
          {recall.process_remark && (
            <div>
              处理备注：<span className="text-slate-300">{recall.process_remark}</span>
            </div>
          )}
          {recall.safety_by && recall.safety_time && (
            <div className="text-emerald-400">
              安全员确认：
              <span className="font-medium">{recall.safety_by}</span>
              <span className="text-slate-500"> · </span>
              <span>{formatTime(recall.safety_time)}</span>
            </div>
          )}
        </div>
      )}

      <div className="mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">处理备注（可选）</div>
        <input
          type="text"
          value={remarkInput}
          onChange={e => setRemarkInput(e.target.value)}
          placeholder="如：已与仓库核对后修正 / 等厂家回复 / 需王工介入"
          className="w-full px-3 py-1.5 text-sm rounded-sm bg-slate-800 border border-slate-600
                     text-slate-200 placeholder-slate-500
                     focus:outline-none focus:border-shield-400
                     focus:ring-1 focus:ring-shield-400
                     focus:ring-offset-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-700/70">
        {PROCESS_BUTTONS.map(btn => (
          <button
            key={btn.status}
            onClick={() => handleStatusChange(btn.status, btn.defaultRemark)}
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
