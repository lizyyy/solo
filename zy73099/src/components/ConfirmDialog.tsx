import * as React from 'react';
import { Modal } from './Modal';
import { CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  currentContent: string;
  onConfirm: (remark: string, contentAfter: string) => void;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  currentContent,
  onConfirm,
}: ConfirmDialogProps) {
  const [remark, setRemark] = React.useState('');
  const [contentAfter, setContentAfter] = React.useState(currentContent);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setContentAfter(currentContent);
      setRemark('');
    }
  }, [open, currentContent]);

  const handleConfirm = () => {
    setSubmitting(true);
    setTimeout(() => {
      onConfirm(remark.trim(), contentAfter.trim());
      setSubmitting(false);
    }, 300);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-2 ring-emerald-400/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">人工确认交底内容</h3>
            <p className="mt-0.5 text-xs text-slate-500">{title}</p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !contentAfter.trim()}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
            {submitting ? '确认中...' : '确认交底内容'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
              <FileText className="h-3.5 w-3.5" strokeWidth={2.5} />
              确认前内容
            </div>
            <div className="min-h-[120px] rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4 text-[13.5px] leading-relaxed text-slate-700">
              {currentContent || <span className="text-slate-400 italic">（无内容）</span>}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              确认后内容（可修改）
            </div>
            <textarea
              value={contentAfter}
              onChange={(e) => setContentAfter(e.target.value)}
              rows={6}
              placeholder="请填写确认后的交底内容，如有修改请直接编辑..."
              className="min-h-[120px] w-full resize-none rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 text-[13.5px] leading-relaxed text-slate-800 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            确认备注（给第二天复盘看）
          </label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="例如：核对图纸无误、班组已签字、材料到位等。第二天复盘时可看到备注。"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-[13.5px] leading-relaxed text-slate-800 transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-[11.5px] leading-relaxed text-slate-500">
          <strong className="text-slate-700">提示：</strong>
          确认后系统将自动保存「确认前 ↔ 确认后」的差异对比，操作人和时间戳一并留痕，第二天复盘时可在详情页查看完整的变更轨迹。
        </div>
      </div>
    </Modal>
  );
}
