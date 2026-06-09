import { User, Clock, Shield, BadgeCheck, ArrowRight, History as HistoryIcon } from 'lucide-react';
import type { JudgmentRecord } from '../types';
import { JUDGMENT_LABELS, SHIFT_LABELS } from '../types';

interface HistoryTimelineProps {
  records: JudgmentRecord[];
  compact?: boolean;
}

const ROLE_LABEL: Record<string, string> = { reviewer: '审核员', supervisor: '维保主管' };
const ROLE_BADGE: Record<string, string> = {
  reviewer: 'bg-slate-100 text-slate-700 border-slate-200',
  supervisor: 'bg-indigo-100 text-indigo-700 border-indigo-300',
};
const SHIFT_BG: Record<string, string> = {
  morning: 'bg-amber-100 text-amber-800',
  afternoon: 'bg-sky-100 text-sky-800',
  night: 'bg-violet-100 text-violet-800',
};
const JUDGE_COLOR: Record<string, string> = {
  normal: 'bg-emerald-600 text-white',
  abnormal: 'bg-red-600 text-white',
  pending_review: 'bg-amber-500 text-white',
};

export function HistoryTimeline({ records, compact = false }: HistoryTimelineProps) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className={`text-center text-slate-400 text-xs py-6 ${compact ? '' : 'bg-slate-50 rounded-md border border-dashed border-slate-200'}`}>
        <HistoryIcon className={`mx-auto mb-1.5 opacity-50 ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} />
        暂无判断修改历史
      </div>
    );
  }

  return (
    <div className="relative">
      {!compact && (
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <HistoryIcon className="w-4 h-4" />
          判断修改时间链
          <span className="text-[11px] text-slate-500 font-normal ml-1">
            （下一班次可查看每个最终值的决策背景）
          </span>
        </div>
      )}
      <div className="relative pl-6 space-y-3">
        <div className="absolute left-2.5 top-1 bottom-1 w-0.5 bg-gradient-to-b from-slate-300 to-slate-200" />

        {sorted.map((r, i) => {
          const isFirst = i === 0;
          const isLast = i === sorted.length - 1;
          return (
            <div key={r.id} className="relative">
              <div className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white ${
                r.operatorRole === 'supervisor' ? 'bg-indigo-500 ring-2 ring-indigo-200' : 'bg-slate-500'
              } shadow-sm`}>
                {isLast && <div className="absolute inset-0 rounded-full animate-ping bg-indigo-400/40" />}
              </div>

              <div className={`rounded-lg border ${compact ? 'p-2.5' : 'p-3.5'} bg-white ${
                r.operatorRole === 'supervisor' ? 'border-indigo-200 shadow-sm' : 'border-slate-200'
              }`}>
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border ${ROLE_BADGE[r.operatorRole]} font-medium`}>
                    {r.operatorRole === 'supervisor' ? <Shield className="w-2.5 h-2.5" /> : <BadgeCheck className="w-2.5 h-2.5" />}
                    {ROLE_LABEL[r.operatorRole]}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${SHIFT_BG[r.shift]} font-medium`}>
                    {SHIFT_LABELS[r.shift]}
                  </span>
                  {isFirst && <span className="text-[10px] text-slate-500 border border-slate-200 bg-slate-50 rounded px-1.5 py-0.5">初始判断</span>}
                  {isLast && <span className="text-[10px] text-white bg-indigo-600 rounded px-1.5 py-0.5 font-semibold">当前值</span>}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {r.oldJudgment && (
                    <>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${JUDGE_COLOR[r.oldJudgment]} opacity-80 line-through`}>
                        {JUDGMENT_LABELS[r.oldJudgment]}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${JUDGE_COLOR[r.newJudgment]}`}>
                    → {JUDGMENT_LABELS[r.newJudgment]}
                  </span>
                </div>

                {!compact && (
                  <div className="text-[11px] text-slate-700 bg-slate-50 rounded px-2 py-1.5 border border-slate-100 leading-snug mb-1.5">
                    <b>原因：</b>{r.reason}
                  </div>
                )}
                {compact && r.reason && (
                  <div className="text-[10px] text-slate-600 truncate" title={r.reason}>
                    原因：{r.reason}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{r.operator}</span>
                  <span className="inline-flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{r.changedAt.slice(5, 16)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
