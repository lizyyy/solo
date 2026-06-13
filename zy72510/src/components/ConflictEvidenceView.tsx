import { useState } from 'react';
import type { ConflictEvidence, Sample } from '../../shared/types';
import { api } from '@/api/client';

interface ConflictEvidenceViewProps {
  conflict: ConflictEvidence;
  sample?: Sample;
  onResolved?: () => void;
}

export default function ConflictEvidenceView({ conflict, sample, onResolved }: ConflictEvidenceViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingResolution, setPendingResolution] = useState<'confirm_gray' | 'reject_gray' | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await api.resolveConflict(conflict.id, {
        resolution: pendingResolution!,
        reason: reason.trim(),
        operator: '审核员',
      });
      setDialogOpen(false);
      setReason('');
      setPendingResolution(null);
      onResolved?.();
    } finally {
      setLoading(false);
    }
  }

  function openDialog(resolution: 'confirm_gray' | 'reject_gray') {
    setPendingResolution(resolution);
    setDialogOpen(true);
  }

  const typeLabel = conflict.type === 'label_mismatch' ? '标签不一致' : '留言矛盾';

  return (
    <div className="border border-white/10 rounded-sm overflow-hidden bg-slate-800/30">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-sm bg-red-500/15 text-red-400 border border-red-500/30 font-medium">
            {typeLabel}
          </span>
          <span className="text-xs text-slate-400 font-mono">{conflict.sampleId}</span>
          {conflict.resolved && (
            <span className="text-xs px-2 py-0.5 rounded-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              已{conflict.resolution === 'confirm_gray' ? '确认' : '驳回'}
            </span>
          )}
        </div>
        {sample && (
          <span className="text-xs text-slate-500">
            {sample.content.length > 40 ? sample.content.slice(0, 40) + '…' : sample.content}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-white/10">
        <div className="p-4">
          <div className="text-xs font-medium text-slate-400 mb-2">灰度侧</div>
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
            <p className="text-sm text-red-300">{conflict.graySide}</p>
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-400 mb-2">标注员侧</div>
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-sm">
            <p className="text-sm text-red-300">{conflict.annotatorSide}</p>
          </div>
        </div>
      </div>

      {!conflict.resolved && (
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-white/10 bg-slate-800/30">
          <button
            onClick={() => openDialog('confirm_gray')}
            className="rounded-sm px-3 py-1.5 font-medium text-sm bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
          >
            确认灰度
          </button>
          <button
            onClick={() => openDialog('reject_gray')}
            className="rounded-sm px-3 py-1.5 font-medium text-sm bg-red-500 hover:bg-red-400 text-white transition-colors"
          >
            驳回灰度
          </button>
        </div>
      )}

      {conflict.resolved && conflict.resolvedReason && (
        <div className="px-4 py-3 border-t border-white/10 bg-slate-800/20">
          <p className="text-xs text-slate-400">
            处理理由：<span className="text-slate-300">{conflict.resolvedReason}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            处理人：{conflict.resolvedBy} · {conflict.resolvedAt ? new Date(conflict.resolvedAt).toLocaleString('zh-CN') : ''}
          </p>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[420px] bg-slate-900 border border-white/10 rounded-sm shadow-xl">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {pendingResolution === 'confirm_gray' ? '确认灰度判定' : '驳回灰度判定'}
              </h3>
            </div>
            <div className="p-5">
              <label className="block text-sm text-slate-300 mb-2">处理理由（必填）</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请说明理由..."
                rows={4}
                className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-slate-800/30">
              <button
                onClick={() => {
                  setDialogOpen(false);
                  setReason('');
                  setPendingResolution(null);
                }}
                className="rounded-sm px-3 py-1.5 font-medium text-sm text-slate-300 hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!reason.trim() || loading}
                className={`rounded-sm px-3 py-1.5 font-medium text-sm text-white transition-colors ${
                  pendingResolution === 'confirm_gray'
                    ? 'bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40'
                    : 'bg-red-500 hover:bg-red-400 disabled:bg-red-500/40'
                } disabled:cursor-not-allowed`}
              >
                {loading ? '处理中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
