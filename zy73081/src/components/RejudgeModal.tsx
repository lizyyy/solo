import { useEffect, useState } from 'react';
import { X, AlertCircle, Send, Paperclip } from 'lucide-react';
import type { CollisionRecord, CollisionStatus, RejudgePayload } from '@/types';
import { STATUS_LABEL } from '@/types';
import { StatusTag } from '@/components/StatusTag';
import { useCollisionStore } from '@/store/useCollisionStore';

interface Props {
  open: boolean;
  record: CollisionRecord | null;
  onClose: () => void;
  onSuccess?: (updated: CollisionRecord) => void;
}

const OPTIONS: CollisionStatus[] = ['PASSED', 'PENDING_EVIDENCE', 'REJECTED'];

export function RejudgeModal({ open, record, onClose, onSuccess }: Props) {
  const { loading, actions } = useCollisionStore();
  const [form, setForm] = useState<RejudgePayload>({
    newStatus: 'PASSED', reason: '', operator: '老叶', evidenceUrls: [],
  });
  const [errors, setErrors] = useState<{ reason?: string }>({});

  useEffect(() => {
    if (open && record) {
      setForm({
        newStatus: record.status === 'MANUAL_REJUDGED' ? 'PASSED' : OPTIONS[0],
        reason: '',
        operator: '老叶',
        evidenceUrls: [],
      });
      setErrors({});
    }
  }, [open, record?.id]);

  if (!open || !record) return null;

  const submit = async () => {
    if (!form.reason.trim()) {
      setErrors({ reason: '改判理由必填，便于后续追溯原因' });
      return;
    }
    await actions.rejudge(record.id, form);
    const fresh = await (await import('@/services/collisionService')).CollisionService.get(record.id);
    onClose();
    if (fresh) onSuccess?.(fresh);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_.2s_ease]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-[slideUp_.25s_ease]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-status-manual/5 to-indigo-50/30">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 text-status-manual" />
              <h3 className="text-base font-bold text-slate-800">改判碰撞记录</h3>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <span className="font-mono tnum bg-slate-100 px-1.5 py-0.5 rounded mr-2">{record.id}</span>
              {record.projectName} · {record.floor} · {record.nodeCode}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500">当前状态</span>
            <StatusTag status={record.status} rejudgeCount={record.rejudgeCount} />
            <span className="text-xs text-slate-400">→</span>
            <span className="text-xs text-slate-500">新状态</span>
            <select
              value={form.newStatus}
              onChange={(e) => setForm({ ...form, newStatus: e.target.value as CollisionStatus })}
              className="ml-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-status-manual/30 cursor-pointer"
            >
              {OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              改判理由 <span className="text-status-rejected">*</span>
            </label>
            <textarea
              rows={4}
              value={form.reason}
              onChange={(e) => {
                setForm({ ...form, reason: e.target.value });
                if (errors.reason) setErrors({});
              }}
              placeholder="请说明改判依据，如：坐标修正后净距满足40mm；设计变更DS-2026-042号；现场实测数据复核..."
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none transition-colors
                ${errors.reason ? 'border-status-rejected focus:ring-status-rejected/30' : 'border-slate-200 focus:ring-brand-500/30'}`}
            />
            {errors.reason && (
              <p className="text-[11px] text-status-rejected mt-1">{errors.reason}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              操作人
            </label>
            <input
              value={form.operator}
              onChange={(e) => setForm({ ...form, operator: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Paperclip className="w-4 h-4" />
              <span>补充证据（模拟）：此版本暂用文字描述替代文件上传</span>
            </div>
            <input
              placeholder="证据描述：如 会议纪要2026-06-08第3条、设计变更单DS-2026-042、现场照片IMG_8842..."
              onChange={(e) => setForm({ ...form, evidenceUrls: [e.target.value] })}
              className="mt-2 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-status-manual hover:bg-violet-600 active:bg-violet-700 rounded-lg shadow-sm shadow-status-manual/25 disabled:opacity-60 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>确认改判并写入历史</span>
          </button>
        </div>
      </div>
    </div>
  );
}
