import { useEffect, useMemo } from 'react';
import { X, History as HistoryIcon, ArrowRight } from 'lucide-react';
import type { CollisionRecord } from '@/types';
import { StatusTag } from '@/components/StatusTag';
import { useCollisionStore } from '@/store/useCollisionStore';

interface Props {
  open: boolean;
  record: CollisionRecord | null;
  onClose: () => void;
}

export function HistoryDrawer({ open, record, onClose }: Props) {
  const { history, actions } = useCollisionStore();

  useEffect(() => {
    if (open && record) actions.loadHistory(record.id);
  }, [open, record, actions]);

  const items = useMemo(() => history, [history]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-[fadeIn_.2s_ease]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-[slideInRight_.3s_ease]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-brand-50/40">
          <div>
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-4.5 h-4.5 text-brand-500" />
              <h3 className="text-base font-bold text-slate-800">历史改判记录</h3>
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono tnum">
              {record?.id} · 共 {items.length} 次变更
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {record && items.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs">
              <HistoryIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <div>暂无改判历史</div>
              <div className="mt-1">当前为初始状态 · 状态：</div>
              <div className="mt-3 inline-flex"><StatusTag status={record.status} /></div>
            </div>
          )}

          <ol className="relative pl-6 border-l border-slate-200 space-y-5">
            {items.map((h, idx) => (
              <li key={h.id} className="relative">
                <span
                  className={`absolute -left-[31px] top-0.5 w-4.5 h-4.5 rounded-full border-2 border-white shadow-sm
                    ${idx === 0 ? 'bg-brand-500' : 'bg-slate-400'}`}
                />
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">{h.operator}</span>
                      <span>·</span>
                      <span className="tnum">{h.timestamp.replace('T', ' ').slice(0, 16)}</span>
                    </div>
                    {idx === 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 border border-brand-200/60">
                        最新
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                    <StatusTag status={h.previousStatus} compact />
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <StatusTag status={h.newStatus} compact />
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded border border-slate-100">
                    {h.reason}
                  </p>

                  {h.evidenceUrls && h.evidenceUrls.length > 0 && h.evidenceUrls[0] && (
                    <div className="mt-2 text-[11px] text-brand-600 bg-brand-50/60 p-2 rounded border border-brand-100/60">
                      📎 {h.evidenceUrls[0]}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
