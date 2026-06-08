import type { DogRecord } from '@/types';
import { findManualConfirmPair } from '@/utils/dataUtils';
import { CheckCheck, ArrowRight, User, ClipboardCheck } from 'lucide-react';
import DiffView from './DiffView';

interface Props { record: DogRecord; }

export default function ManualConfirmView({ record }: Props) {
  const pair = findManualConfirmPair(record);
  const meta = record.manualConfirm;

  if (!pair || !meta) {
    return (
      <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-5 text-sm text-brand-500 text-center">
        <ClipboardCheck className="w-6 h-6 mx-auto mb-2 text-brand-400" />
        本报告无需人工确认节点。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <CheckCheck className="w-4 h-4 text-emerald-600" />
        <h4 className="font-serif font-bold text-brand-800">人工确认前后对比</h4>
        <span className="chip chip-confirm">
          <User className="w-3 h-3" /> {meta.confirmedBy} · {meta.confirmedAt}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        {/* 确认前 */}
        <div className="rounded-2xl border-2 border-anomaly-200 bg-gradient-to-br from-anomaly-50/80 to-cream-50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-anomaly-100">
            <div>
              <div className="text-xs text-anomaly-500 font-semibold mb-0.5">确认前 · Before</div>
              <div className="font-mono font-bold text-brand-700 text-sm">v{pair.before.version}</div>
            </div>
            <div className="chip chip-anomaly text-[10px]">待审核</div>
          </div>
          <div className="text-[11px] text-brand-500 space-y-1">
            <div>📅 {pair.before.timestamp}</div>
            <div>👤 操作人：{pair.before.operator}</div>
          </div>
          <div className="mt-3 text-xs text-brand-700 bg-white/80 rounded-lg px-3 py-2 border border-white">
            <span className="font-semibold">结论：</span>
            <span className="text-anomaly-600 font-semibold">{pair.before.snapshot.conclusion}</span>
          </div>
          {pair.before.remark && (
            <div className="mt-2 text-[11px] text-brand-500 italic">「{pair.before.remark}」</div>
          )}
        </div>

        {/* 箭头 */}
        <div className="flex items-center justify-center">
          <div className="hidden lg:flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold text-center leading-tight">
              人工<br />确认
            </div>
          </div>
          <div className="lg:hidden flex items-center justify-center py-2">
            <div className="w-full h-10 rounded-full bg-gradient-to-r from-anomaly-400 via-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
              人工确认 <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </div>

        {/* 确认后 */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-brand-50 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-100">
            <div>
              <div className="text-xs text-emerald-600 font-semibold mb-0.5">确认后 · After</div>
              <div className="font-mono font-bold text-brand-700 text-sm">v{pair.after.version}</div>
            </div>
            <div className="chip chip-confirm text-[10px]">已通过</div>
          </div>
          <div className="text-[11px] text-brand-500 space-y-1">
            <div>📅 {pair.after.timestamp}</div>
            <div>👤 操作人：{pair.after.operator}</div>
          </div>
          <div className="mt-3 text-xs text-brand-700 bg-white/80 rounded-lg px-3 py-2 border border-white">
            <span className="font-semibold">结论：</span>
            <span className="text-emerald-600 font-semibold">{pair.after.snapshot.conclusion}</span>
          </div>
          {pair.after.remark && (
            <div className="mt-2 text-[11px] text-brand-500 italic">「{pair.after.remark}」</div>
          )}
        </div>
      </div>

      {/* 具体变更点 */}
      <div className="pt-2">
        <DiffView a={pair.before} b={pair.after} />
      </div>
    </div>
  );
}
