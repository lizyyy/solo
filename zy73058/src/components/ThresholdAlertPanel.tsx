import { useReviewStore } from '@/store/reviewStore';
import { StatusBadge } from './Badges';
import { AlertTriangle, ExternalLink, Clock, User, ChevronRight } from 'lucide-react';

export function ThresholdAlertPanel() {
  const { getThresholdRecords, setActiveRecordId } = useReviewStore();
  const records = getThresholdRecords();

  if (records.length === 0) return null;

  return (
    <div className="rounded border-2 border-orange-400 overflow-hidden bg-white shadow-sm">
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{
          background:
            'repeating-linear-gradient(45deg, #fff7ed, #fff7ed 10px, #ffedd5 10px, #ffedd5 20px)',
          borderBottom: '2px solid #fb923c',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-orange-900 tracking-wide" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              ⚠️ 阈值临时调高记录 · 独立拎出（不混入正常结果）
            </div>
            <div className="text-xs text-orange-700 mt-0.5">
              共 {records.length} 条——月底复核时必须逐条核对，接手同事可据此判断是否被揉进正常结果
            </div>
          </div>
        </div>
        <span className="text-[11px] px-2 py-1 rounded bg-orange-500 text-white font-semibold">
          MANDATORY REVIEW
        </span>
      </div>

      <div className="divide-y divide-orange-100">
        {records.map((r) => (
          <div
            key={r.id}
            onClick={() => setActiveRecordId(r.id)}
            className="px-5 py-4 flex items-center gap-5 cursor-pointer hover:bg-orange-50/70 transition-colors group"
          >
            <div className="w-1 h-16 rounded-full bg-orange-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-bold text-zinc-800 font-mono">{r.id}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-white font-mono">
                  电梯 {r.elevatorId}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <div className="text-sm text-zinc-700 mb-2 font-medium">{r.summary}</div>
              {r.thresholdInfo && (
                <div className="flex items-center flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-800 border border-red-300 font-mono">
                    旧阈值：{r.thresholdInfo.oldThreshold}
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-400 font-mono font-bold">
                    新阈值：{r.thresholdInfo.newThreshold}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500 text-white font-semibold">
                    漏报 {r.thresholdInfo.triggeredMisses} 次
                  </span>
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />处理：{r.handler}</span>
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{r.handledAt}</span>
              </div>
            </div>
            <button className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 transition-colors">
              复核详情
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              <ExternalLink className="w-3 h-3 opacity-60" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
