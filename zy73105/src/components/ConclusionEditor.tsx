import { useState } from 'react';
import type { ConclusionStatus } from '../types/review';
import { STATUS_LABEL } from '../utils/statusMappings';
import { StatusBadge } from './StatusBadge';
import { Send, X } from 'lucide-react';

interface Props {
  reviewId: string;
  currentStatus: ConclusionStatus;
  onSubmit: (newStatus: ConclusionStatus, reason: string) => void;
}

const OPTIONS: ConclusionStatus[] = ['confirmed', 'pending-material', 'returned', 'draft'];

export function ConclusionEditor({ reviewId, currentStatus, onSubmit }: Props) {
  const [status, setStatus] = useState<ConclusionStatus>(currentStatus);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const submit = () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      onSubmit(status, reason.trim());
      setSubmitting(false);
      setOkMsg('结论已更新，历史记录中已保留本次修改痕迹。');
      setReason('');
      setTimeout(() => setOkMsg(null), 3500);
    }, 500);
  };

  const reset = () => {
    setStatus(currentStatus);
    setReason('');
  };

  const changed = status !== currentStatus || reason.trim().length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            修改结论
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-sm">
            <span className="text-slate-500">当前结论：</span>
            <StatusBadge status={currentStatus} />
          </div>
          <div className="mt-1 text-[11px] text-slate-400 mono">复核编号：{reviewId}</div>
        </div>

        {okMsg && (
          <div className="animate-slide-in-right flex items-center gap-2 rounded-lg border border-status-confirmed/30 bg-status-confirmed-bg px-3 py-2 text-xs font-medium text-status-confirmed">
            <div className="w-1.5 h-1.5 rounded-full bg-status-confirmed animate-pulse" />
            {okMsg}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            选择新结论
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ConclusionStatus)}
            className="select-field w-full"
          >
            {OPTIONS.map((o) => (
              <option key={o} value={o}>
                {STATUS_LABEL[o]}
              </option>
            ))}
          </select>
          {status !== currentStatus && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-status-pending-bg px-2 py-1.5 text-[11px] text-status-pending">
              <X size={11} />
              将由「{STATUS_LABEL[currentStatus]}」改为「
              <span className="font-semibold">{STATUS_LABEL[status]}</span>」
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            修改理由（强制填写 · 将进入历史记录）
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：收到晚到附件 R-2026-0608，遮阳板详图导致原日照结论不成立，需补充再核算书。"
            rows={3}
            className="input-field resize-y"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {reason.length} 字 · 结构工程师老叶 修改人
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={!changed || submitting}
                className="btn btn-secondary"
              >
                重置
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!reason.trim() || submitting}
                className="btn btn-primary"
              >
                <Send size={14} />
                {submitting ? '提交中…' : '提交修改'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
