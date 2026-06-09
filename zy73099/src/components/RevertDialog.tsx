import * as React from 'react';
import { Modal } from './Modal';
import { RotateCcw, AlertCircle, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RevertDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmedContent: string;
  onRevert: (reason: string) => void;
}

export function RevertDialog({
  open,
  onClose,
  title,
  confirmedContent,
  onRevert,
}: RevertDialogProps) {
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const reasonRequired = reason.trim().length >= 8;

  const handleRevert = () => {
    if (!reasonRequired) return;
    setSubmitting(true);
    setTimeout(() => {
      onRevert(reason.trim());
      setSubmitting(false);
    }, 300);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="danger"
      size="lg"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 ring-2 ring-rose-400/30">
            <ShieldX className="h-5 w-5 text-rose-600" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">撤回已确认的交底</h3>
            <p className="mt-0.5 text-xs text-rose-700">{title}</p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            我再想想
          </button>
          <button
            onClick={handleRevert}
            disabled={submitting || !reasonRequired}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
            {submitting ? '撤回中...' : '确认撤回并退回'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-rose-500" strokeWidth={2.2} />
          <div className="space-y-1 text-[13px] leading-relaxed text-rose-800">
            <p className="font-semibold">撤回后将产生如下影响：</p>
            <ul className="ml-4 list-disc space-y-0.5 text-rose-700">
              <li>该交底状态变为「已退回」，月底复核会归入退回记录</li>
              <li>已录入的确认内容和备注不会删除，差异对比仍可复盘查看</li>
              <li>操作人和撤回时间会永久留痕，不可删除</li>
              <li>班组会收到退回通知，需修改后重新提交确认</li>
            </ul>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            当前已确认的内容
          </div>
          <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-[13px] leading-relaxed text-slate-700">
            {confirmedContent}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600">
            <span>撤回原因 <span className="text-rose-600">（至少8字，必填）</span></span>
            <span
              className={cn(
                'font-mono',
                reasonRequired ? 'text-emerald-600' : 'text-slate-400'
              )}
            >
              {reason.trim().length}/8
            </span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="请说明为什么要撤回这条交底，例如：现场条件变更、图纸更新发现错误、班组反馈无法执行等..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-[13.5px] leading-relaxed text-slate-800 transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
        </div>
      </div>
    </Modal>
  );
}
