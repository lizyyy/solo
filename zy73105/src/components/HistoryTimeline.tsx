import { useNavigate } from 'react-router-dom';
import type { ConclusionChange, ConclusionStatus } from '../types/review';
import { STATUS_BADGE_CLASS, STATUS_LABEL, formatDateTime } from '../utils/statusMappings';
import { ArrowRight, Clock } from 'lucide-react';

type HistoryItem = ConclusionChange & { reviewId: string; projectName: string };

interface Props {
  items: HistoryItem[];
  highlightToday?: boolean;
}

function groupByDate(items: HistoryItem[]): Record<string, HistoryItem[]> {
  const g: Record<string, HistoryItem[]> = {};
  items.forEach((it) => {
    const d = new Date(it.changedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!g[key]) g[key] = [];
    g[key].push(it);
  });
  return g;
}

function BadgeFor({ status }: { status: ConclusionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function HistoryTimeline({ items, highlightToday = true }: Props) {
  const navigate = useNavigate();
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
        暂无结论修改记录。
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const groups = groupByDate(items);
  const dates = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="space-y-8">
      {dates.map((date, dateIdx) => {
        const isToday = date === todayStr;
        return (
          <div key={date} className="animate-fade-in-stagger stagger-1">
            <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center gap-3 bg-slate-100/80 backdrop-blur px-1 py-2 rounded-md">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-xs ${
                  isToday && highlightToday
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-md'
                    : 'bg-slate-500'
                }`}
              >
                <Clock size={14} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">{date}</div>
                <div className="text-[11px] text-slate-500">
                  {groups[date].length} 条修改
                  {isToday && highlightToday && (
                    <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      今日 · 老叶的修改
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-auto h-px flex-1 bg-gradient-to-r from-slate-300 to-transparent" />
            </div>

            <div className="relative space-y-4 pl-6 border-l-2 border-slate-200 ml-3">
              {groups[date].map((it, idx) => (
                <div
                  key={it.id}
                  className="relative animate-fade-in-stagger"
                  style={{ animationDelay: `${(dateIdx * 3 + idx) * 80}ms` }}
                >
                  <div
                    className={`absolute -left-[33px] top-3 h-4 w-4 rounded-full border-2 border-white shadow-md ${
                      it.changedBy === '老叶'
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  <div
                    onClick={() => navigate(`/review/${it.reviewId}`)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-card-hover hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="mono font-semibold text-slate-700">{it.reviewId}</span>
                      <span>·</span>
                      <span className="font-medium text-slate-700">{it.projectName}</span>
                      <span className="ml-auto mono">{formatDateTime(it.changedAt)}</span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <BadgeFor status={it.fromStatus} />
                      <ArrowRight size={14} className="text-slate-400" />
                      <BadgeFor status={it.toStatus} />
                      <span className="ml-3 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        修改人：{it.changedBy}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg border-l-4 border-slate-900/40 bg-slate-50 p-3 text-sm text-slate-700 leading-relaxed">
                      {it.changeReason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
