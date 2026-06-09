import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, FileWarning, Layers3, ChevronRight, Search } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';
import type { FilterTab, ReviewRecord } from '../types/review';
import { FILTER_LABEL, STATUS_LABEL, formatDate, hasLateAttachment, hasLayerIssue } from '../utils/statusMappings';
import { StatCard } from '../components/StatCard';
import { FilterTabs } from '../components/FilterTabs';
import { StatusBadge } from '../components/StatusBadge';

function rowClass(r: ReviewRecord): string {
  const late = hasLateAttachment(r.attachments);
  const layer = hasLayerIssue(r.layerIssues);
  if (late && layer) return 'row-both';
  if (late) return 'row-late';
  if (layer) return 'row-layer';
  return '';
}

export function ReviewListPage() {
  const navigate = useNavigate();
  const {
    reviews,
    activeFilter,
    setActiveFilter,
    getFiltered,
    getStats,
  } = useReviewStore();

  const stats = getStats();
  const filtered = getFiltered();

  const filterCounts: Partial<Record<FilterTab, number>> = useMemo(() => {
    const all = reviews;
    return {
      all: all.length,
      confirmed: stats.confirmed,
      'pending-material': stats.pending,
      returned: stats.returned,
      'late-attachment': stats.lateAttachment,
      'layer-issue': stats.layerIssue,
    };
  }, [reviews, stats]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">材料送审表 · 日照体量图纸复核</h1>
        <p className="mt-1 text-sm text-slate-500">
          共 {stats.total} 条记录 · {stats.lateAttachment} 条含晚到附件 · {stats.layerIssue} 条图层命名异常 · 当前筛选「{FILTER_LABEL[activeFilter]}」
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="已确认"
          value={stats.confirmed}
          tone="success"
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          hint="结论正式发出"
        />
        <StatCard
          label="待补件"
          value={stats.pending}
          tone="warning"
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          hint="等待设计方补充"
        />
        <StatCard
          label="退回"
          value={stats.returned}
          tone="danger"
          icon={<XCircle size={18} className="text-rose-600" />}
          hint="需设计方更正重报"
        />
        <StatCard
          label="晚到附件警告"
          value={stats.lateAttachment}
          tone="accent"
          icon={<FileWarning size={18} className="text-orange-600" />}
          hint="曾影响结论判断"
        />
      </div>

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <FilterTabs value={activeFilter} onChange={setActiveFilter} counts={filterCounts} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索项目、图号…"
              className="input-field w-64 pl-8"
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[140px]">复核编号</th>
                <th className="w-[220px]">项目名称</th>
                <th className="w-[150px]">图号</th>
                <th className="w-[110px]">送审日期</th>
                <th className="w-[110px]">复核日期</th>
                <th className="w-[80px]">复核人</th>
                <th className="w-[100px]">状态</th>
                <th className="w-[80px]">附件</th>
                <th className="w-[260px]">当前意见（摘要）</th>
                <th className="w-[60px] text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const late = hasLateAttachment(r.attachments);
                const layer = hasLayerIssue(r.layerIssues);
                const lateCount = r.attachments.filter((a) => a.isLate).length;

                return (
                  <tr
                    key={r.id}
                    className={`${rowClass(r)} animate-fade-in-stagger cursor-pointer group`}
                    style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                    onClick={() => navigate(`/review/${r.id}`)}
                  >
                    <td>
                      <span className="mono font-semibold text-slate-900">{r.id}</span>
                      <div className="mt-0.5 flex gap-1 flex-wrap">
                        {late && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-status-late/15 px-1.5 py-0.5 text-[9px] font-bold text-status-late">
                            <FileWarning size={9} />
                            晚到{lateCount}
                          </span>
                        )}
                        {layer && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-status-layer/15 px-1.5 py-0.5 text-[9px] font-bold text-status-layer">
                            <Layers3 size={9} />
                            图层{r.layerIssues.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-medium text-slate-900">{r.projectName}</td>
                    <td>
                      <span className="mono text-xs text-slate-700">{r.drawingNo}</span>
                    </td>
                    <td>
                      <span className="mono text-xs text-slate-600">{formatDate(r.submissionDate)}</span>
                    </td>
                    <td>
                      <span className="mono text-xs text-slate-600">{formatDate(r.reviewDate)}</span>
                    </td>
                    <td className="text-sm text-slate-600">{r.reviewer}</td>
                    <td>
                      <StatusBadge status={r.conclusionStatus} size="sm" />
                    </td>
                    <td className="text-sm">
                      <span className="mono font-semibold text-slate-800">
                        {r.attachments.length}
                      </span>
                      <span className="text-slate-400 text-xs ml-0.5">份</span>
                    </td>
                    <td className="text-xs text-slate-600 leading-snug pr-6">
                      <span className="line-clamp-2 group-hover:line-clamp-none transition-all">
                        {r.currentOpinion || '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 group-hover:text-slate-900">
                        分析
                        <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                    当前筛选下无记录 · 当前状态：{STATUS_LABEL[activeFilter as keyof typeof STATUS_LABEL] ?? FILTER_LABEL[activeFilter]}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
          <span>共 {filtered.length} 条 · 颜色条含义：</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-3 w-1 rounded bg-status-late" />
              含晚到附件
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-3 w-1 rounded bg-status-layer" />
              图层命名异常
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="block h-3 w-1 rounded" style={{ background: 'linear-gradient(180deg, #f97316, #ec4899)' }} />
              双重异常
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
