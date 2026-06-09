import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';
import type { ConclusionStatus, ReviewRecord } from '../types/review';
import { ReviewCard } from '../components/ReviewCard';

interface ColumnDef {
  key: ConclusionStatus;
  title: string;
  headerClass: string;
  icon: typeof CheckCircle2;
  desc: string;
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'confirmed',
    title: '已确认',
    headerClass: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
    icon: CheckCircle2,
    desc: '结论已正式发出的复核',
  },
  {
    key: 'pending-material',
    title: '待补件',
    headerClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
    icon: AlertTriangle,
    desc: '等设计方补充材料（含晚到附件影响的）',
  },
  {
    key: 'returned',
    title: '退回',
    headerClass: 'bg-gradient-to-r from-rose-600 to-rose-500',
    icon: XCircle,
    desc: '需设计方更正后重报',
  },
];

export function MonthlyBoardPage() {
  const { reviews } = useReviewStore();

  const grouped = useMemo(() => {
    const g: Record<ConclusionStatus, ReviewRecord[]> = {
      confirmed: [],
      'pending-material': [],
      returned: [],
      draft: [],
    };
    reviews.forEach((r) => {
      if (g[r.conclusionStatus]) g[r.conclusionStatus].push(r);
    });
    return g;
  }, [reviews]);

  const totalDone = grouped.confirmed.length + grouped.returned.length;
  const totalWork = reviews.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            月底分类看板 · 6 月第 2 周
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            按结论状态将「已确认 / 待补件 / 退回」分清 · 结构工程师老叶月底复核专用视图
          </p>
        </div>

        <div className="card px-5 py-3">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{totalDone}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">已处理</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-status-pending">{grouped['pending-material'].length}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">进行中</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-700">
                {totalWork > 0 ? Math.round((totalDone / totalWork) * 100) : 0}
                <span className="text-sm font-medium text-slate-500 ml-0.5">%</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">完成率</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col, colIdx) => {
          const Icon = col.icon;
          const list = grouped[col.key];
          return (
            <div
              key={col.key}
              className="kanban-column animate-fade-in-stagger"
              style={{ animationDelay: `${colIdx * 80}ms` }}
            >
              <div className={`kanban-header ${col.headerClass}`}>
                <div className="flex items-center gap-2">
                  <Icon size={15} />
                  <span>{col.title}</span>
                  <span className="ml-1 inline-flex min-w-[22px] items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-bold">
                    {list.length}
                  </span>
                </div>
              </div>
              <div className="px-3 pt-2 pb-1 text-[11px] text-slate-500 bg-white/70 border-b border-slate-100">
                {col.desc}
              </div>
              <div className="kanban-body scrollbar-thin">
                {list.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 bg-white/60">
                    暂无「{col.title}」记录
                  </div>
                ) : (
                  list.map((r, idx) => (
                    <div
                      key={r.id}
                      className="animate-fade-in-stagger"
                      style={{ animationDelay: `${colIdx * 80 + idx * 60}ms` }}
                    >
                      <ReviewCard review={r} />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
