import { useState } from 'react';
import { X, AlertTriangle, BookOpen, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useManifestStore } from '../store/manifestStore';
import { cn } from '../lib/utils';

interface ConflictModalProps {
  conflictId: string;
  onClose: () => void;
}

export function ConflictModal({ conflictId, onClose }: ConflictModalProps) {
  const [decision, setDecision] = useState<'knowledge' | 'ticket' | 'defer' | null>(null);
  const [reason, setReason] = useState('');
  const conflict = useManifestStore((s) => s.conflicts.find((c) => c.id === conflictId));
  const resolveConflict = useManifestStore((s) => s.resolveConflict);

  if (!conflict) return null;

  const handleConfirm = () => {
    if (!decision) return;
    const status =
      decision === 'knowledge'
        ? 'confirmed_knowledge'
        : decision === 'ticket'
        ? 'confirmed_ticket'
        : 'deferred';
    resolveConflict(conflictId, status, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-zinc-700 bg-[#1a1d23] shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">字段冲突确认</h3>
              <p className="text-sm text-zinc-400">
                字段「{conflict.fieldLabel}」知识库引用与线上工单不一致，请人工裁决
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr,auto,1fr]">
            <div
              className={cn(
                'cursor-pointer rounded-xl border-2 p-5 transition-all',
                decision === 'knowledge'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              )}
              onClick={() => setDecision('knowledge')}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/20">
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="font-medium text-indigo-300">知识库引用</span>
                {decision === 'knowledge' && (
                  <CheckCircle2 className="ml-auto h-5 w-5 text-indigo-400" />
                )}
              </div>
              <div className="mb-2 text-sm font-mono text-white">{conflict.knowledgeValue}</div>
              <div className="text-xs text-zinc-400">
                来源：<span className="break-all text-zinc-500">{conflict.knowledgeSource}</span>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400">
                VS
              </div>
            </div>

            <div
              className={cn(
                'cursor-pointer rounded-xl border-2 p-5 transition-all',
                decision === 'ticket'
                  ? 'border-pink-500 bg-pink-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              )}
              onClick={() => setDecision('ticket')}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-pink-500/20">
                  <MessageSquare className="h-4 w-4 text-pink-400" />
                </div>
                <span className="font-medium text-pink-300">线上反馈工单</span>
                {decision === 'ticket' && (
                  <CheckCircle2 className="ml-auto h-5 w-5 text-pink-400" />
                )}
              </div>
              <div className="mb-2 text-sm font-mono text-white">{conflict.ticketValue}</div>
              <div className="text-xs text-zinc-400">
                来源：<span className="text-zinc-500">{conflict.ticketSource}</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div
              className={cn(
                'cursor-pointer rounded-lg border border-zinc-700 p-4 transition-all',
                decision === 'defer'
                  ? 'border-zinc-500 bg-zinc-700/30'
                  : 'bg-zinc-800/30 hover:bg-zinc-800/50'
              )}
              onClick={() => setDecision('defer')}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-300">暂不裁决</span>
                {decision === 'defer' && <CheckCircle2 className="ml-auto h-4 w-4 text-zinc-400" />}
              </div>
              <p className="mt-1 text-xs text-zinc-500">延后处理，冲突状态保持不变</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-zinc-300">决策理由（必填）</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明裁决依据..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!decision || !reason.trim()}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            确认裁决
          </button>
        </div>
      </div>
    </div>
  );
}
