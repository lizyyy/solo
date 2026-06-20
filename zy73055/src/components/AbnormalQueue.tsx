import { AlertTriangle, AlertOctagon, ChevronRight, Clock, BookOpen } from 'lucide-react';
import { useWorkOrderStore, useAbnormalQueue } from '../store/workOrderStore';
import { JUDGMENT_LABELS, PRIORITY_LABELS, SHIFT_LABELS } from '../types';
import { LateBadge } from './LateBadge';

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

export function AbnormalQueue() {
  const abnormalQueue = useAbnormalQueue();
  const { selectOrder, selectedOrderId } = useWorkOrderStore();

  const hasLate = (o: typeof abnormalQueue[number]) =>
    o.photos.some(p => p.isLateArrival) || o.attachments.some(a => a.isLateArrival);
  const hasOld = (o: typeof abnormalQueue[number]) =>
    o.photos.some(p => p.hitsOldTerminology);

  const sorted = [...abnormalQueue].sort((a, b) => {
    const pw: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const d = pw[b.priority] - pw[a.priority];
    if (d !== 0) return d;
    return new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime();
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm flex flex-col h-full max-h-[calc(100vh-180px)] min-h-[640px]">
      <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-amber-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-red-600">
              <AlertOctagon className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">异常队列</div>
              <div className="text-[11px] text-slate-500">与明细表 / 统计完全同源 · 按优先级排序</div>
            </div>
          </div>
          <div className="px-2 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold">
            {abnormalQueue.length}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sorted.length === 0 && (
          <div className="p-10 text-center text-slate-400 text-xs">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <div className="font-medium">当前无异常或待复核工单</div>
            <div className="mt-1 text-[11px]">所有工单已通过审核</div>
          </div>
        )}

        {sorted.map((o) => {
          const active = selectedOrderId === o.id;
          return (
            <button
              key={o.id}
              onClick={() => selectOrder(o.id)}
              className={`w-full text-left p-3 rounded-md border transition-all duration-200 group
                ${active
                  ? 'border-red-400 bg-red-50 shadow-md ring-2 ring-red-200'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm hover:bg-slate-50/60'
                }
                ${o.judgment === 'abnormal' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-amber-400'}
              `}
              style={{ animation: active ? undefined : 'slideInRight 0.3s ease-out both' }}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[o.priority]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[11px] text-slate-700 font-semibold truncate">{o.orderNo}</span>
                    <ChevronRight className={`w-3 h-3 text-slate-400 group-hover:text-slate-700 transition-all ${active ? 'translate-x-0.5' : ''}`} />
                  </div>
                  <div className="text-xs font-semibold text-slate-800 truncate" title={o.deviceName}>
                    {o.deviceName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{o.deviceNo}</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 mb-2 line-clamp-2 leading-relaxed" title={o.faultDescription}>
                <span className="text-red-500">●</span> {o.faultType} — {o.faultDescription}
              </div>

              <div className="flex flex-wrap items-center gap-1 mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  o.judgment === 'abnormal' ? 'bg-red-100 border-red-200 text-red-700' : 'bg-amber-100 border-amber-200 text-amber-700'
                }`}>
                  {JUDGMENT_LABELS[o.judgment]}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  o.priority === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                  o.priority === 'high' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                  'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  {PRIORITY_LABELS[o.priority]}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {SHIFT_LABELS[o.shift]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {hasLate(o) && <LateBadge compact />}
                {hasOld(o) && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700">
                    <BookOpen className="w-2.5 h-2.5" />旧说法
                  </span>
                )}
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 ml-auto">
                  <Clock className="w-2.5 h-2.5" />
                  {o.reportTime.slice(5, 16)}
                </span>
              </div>

              {o.judgmentHistory.length >= 2 && (
                <div className="mt-2 pt-2 border-t border-dashed border-slate-200 text-[10px] text-indigo-600 bg-indigo-50/50 -mx-3 -mb-3 px-3 py-1.5 rounded-b-md">
                  📜 判断被修改 {o.judgmentHistory.length} 次，点击查看完整时间链
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 text-center">
        点击工单 → 自动滚动定位明细行
      </div>
    </div>
  );
}
