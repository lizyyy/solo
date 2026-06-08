import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '@/store/reviewStore.js';
import { StatusBadge, AnomalyBadge, ExceptionTypeBadge } from '@/components/StatusBadge.js';
import {
  ClipboardList, AlertTriangle, Syringe, CheckCircle2, Search, Filter,
  ChevronRight, TrendingUp, Calendar, Phone, PawPrint,
} from 'lucide-react';
import type { ReviewStatus } from '../../shared/types.js';

const statusFilterOptions: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待复核' },
  { value: 'needsInfo', label: '需补充' },
  { value: 'exception', label: '有异常' },
  { value: 'approved', label: '已通过' },
];

export default function DashboardPage() {
  const nav = useNavigate();
  const records = useReviewStore(s => s.records);
  const filters = useReviewStore(s => s.filters);
  const loading = useReviewStore(s => s.loading.records);
  const fetchRecords = useReviewStore(s => s.fetchRecords);
  const setFilters = useReviewStore(s => s.setFilters);
  const fetchExceptions = useReviewStore(s => s.fetchExceptions);
  const exceptions = useReviewStore(s => s.exceptions);

  useEffect(() => {
    fetchRecords();
    fetchExceptions();
  }, []);

  const stats = useMemo(() => {
    const pending = records.filter(r => r.reviewStatus === 'pending' || r.reviewStatus === 'needsInfo').length;
    const exceptionCount = exceptions.length;
    const vaccineMissing = records.filter(r => r.hasVaccineMissing).length;
    const approved = records.filter(r => r.reviewStatus === 'approved').length;
    return { pending, exceptionCount, vaccineMissing, approved, total: records.length };
  }, [records, exceptions]);

  const statCards = [
    { label: '待复核', value: stats.pending, Icon: ClipboardList, gradient: 'from-accent-300 to-accent-500', bg: 'bg-accent-300/10' },
    { label: '异常记录', value: stats.exceptionCount, Icon: AlertTriangle, gradient: 'from-warn-400 to-warn-600', bg: 'bg-warn-400/10' },
    { label: '疫苗缺失', value: stats.vaccineMissing, Icon: Syringe, gradient: 'from-warn-500 to-warn-600', bg: 'bg-warn-500/10' },
    { label: '已复核通过', value: stats.approved, Icon: CheckCircle2, gradient: 'from-brand-400 to-brand-600', bg: 'bg-brand-400/10' },
  ];

  return (
    <div className="space-y-6 stagger">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => (
          <div key={i} className="card card-hover p-5 relative overflow-hidden group">
            <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br ${c.gradient} opacity-15 group-hover:opacity-25 transition-opacity`} />
            <div className="relative space-y-2.5">
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                <c.Icon size={20} className={`bg-gradient-to-br ${c.gradient} bg-clip-text`} style={{ color: '#1B4332' }} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif font-bold text-4xl text-ink-700 leading-none">{c.value}</span>
                <TrendingUp size={14} className="text-brand-500" />
              </div>
              <div className="text-sm text-ink-500">{c.label}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-ink-500" />
            <span className="text-sm font-semibold text-ink-700">快捷筛选</span>
            <span className="text-xs text-ink-300">共 {records.length} 条记录</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              value={filters.keyword || ''}
              onChange={e => setFilters({ keyword: e.target.value })}
              placeholder="搜索宠物姓名 / 品种 / 主人..."
              className="input-base pl-9 py-2.5"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-ink-500">状态：</span>
          {statusFilterOptions.map(opt => {
            const active = (opt.value === 'all' && !filters.status) || filters.status === opt.value;
            return (
              <button key={opt.value}
                onClick={() => setFilters({ status: opt.value === 'all' ? undefined : (opt.value as ReviewStatus) })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                  ${active ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25' : 'bg-ink-50 text-ink-500 hover:bg-ink-100 border border-ink-100'}`}>
                {opt.label}
              </button>
            );
          })}

          <div className="w-px h-6 bg-ink-200 mx-1 hidden sm:block" />

          <label className="inline-flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer select-none">
            <input type="checkbox" checked={!!filters.vaccineMissing}
              onChange={e => setFilters({ vaccineMissing: e.target.checked || undefined })}
              className="w-3.5 h-3.5 accent-warn-500" />
            仅看疫苗缺失
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer select-none">
            <input type="checkbox" checked={!!filters.weightAnomaly}
              onChange={e => setFilters({ weightAnomaly: e.target.checked || undefined })}
              className="w-3.5 h-3.5 accent-warn-500" />
            仅看体重异常
          </label>

          {(filters.status || filters.vaccineMissing || filters.weightAnomaly || filters.keyword) && (
            <button onClick={() => setFilters({ status: undefined, vaccineMissing: undefined, weightAnomaly: undefined, keyword: '' })}
              className="ml-auto text-xs text-warn-500 hover:underline">
              清空筛选
            </button>
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="table-th rounded-tl-2xl">宠物信息</th>
                <th className="table-th">寄养时段</th>
                <th className="table-th">复核状态</th>
                <th className="table-th">异常标记</th>
                <th className="table-th">最新备注</th>
                <th className="table-th rounded-tr-2xl">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-td text-center py-10 text-ink-300 text-sm">加载中...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-td text-center py-10 text-ink-300 text-sm">无匹配记录，尝试调整筛选条件</td>
                </tr>
              ) : records.map((r, i) => (
                <tr key={r.id}
                  className={`${i % 2 ? 'bg-ink-50/30' : ''} hover:bg-brand-50/40 transition-colors group`}>
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-300 flex items-center justify-center shrink-0">
                        <PawPrint size={18} className="text-brand-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink-700">{r.petName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-100 text-ink-500">{r.id}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-ink-500 mt-0.5">
                          <span>{r.petBreed}</span>
                          <span className="flex items-center gap-1"><Phone size={10} />{r.ownerName}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1.5 text-xs text-ink-500">
                      <Calendar size={12} />
                      <span>{r.startDate.slice(5)} ~ {r.endDate.slice(5)}</span>
                    </div>
                  </td>
                  <td className="table-td">
                    <StatusBadge status={r.reviewStatus} size="sm" />
                  </td>
                  <td className="table-td">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {r.hasWeightAnomaly && <AnomalyBadge kind="weight" />}
                      {r.hasVaccineMissing && <AnomalyBadge kind="vaccine" />}
                      {r.abnormalPhotosCount > 0 && <AnomalyBadge kind="photo" />}
                      {!r.hasWeightAnomaly && !r.hasVaccineMissing && r.abnormalPhotosCount === 0 && (
                        <span className="text-xs text-brand-500">无异常</span>
                      )}
                    </div>
                  </td>
                  <td className="table-td">
                    <div className="max-w-[260px]">
                      <p className="text-xs text-ink-700 line-clamp-2 leading-relaxed">{r.latestRemark || '暂无备注'}</p>
                      {r.latestOperator && (
                        <p className="text-[10px] text-ink-300 mt-0.5">操作人：{r.latestOperator}</p>
                      )}
                    </div>
                  </td>
                  <td className="table-td">
                    <button onClick={() => nav(`/record/${r.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition group-hover:shadow-sm">
                      进入复核 <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="section-title">异常队列概览</div>
          <button onClick={() => nav('/exceptions')} className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
            查看完整队列 <ChevronRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {exceptions.slice(0, 3).map(e => (
            <div key={e.id}
              className={`rounded-xl p-3.5 border transition-all hover:shadow-md
                ${e.isConsistent ? 'border-ink-100 bg-white' : 'border-warn-400/50 bg-warn-400/5'}`}
              onClick={() => nav(`/record/${e.recordId}`)}>
              <div className="flex items-center justify-between mb-2">
                <ExceptionTypeBadge type={e.exceptionType} />
                <StatusBadge status={e.status} size="sm" />
              </div>
              <div className="font-semibold text-ink-700 text-sm mb-0.5">{e.petName} <span className="text-ink-300 text-[11px]">({e.id})</span></div>
              <p className="text-xs text-ink-500 line-clamp-2 leading-relaxed">{e.remark}</p>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                {e.isConsistent ? (
                  <span className="text-brand-600 font-medium">✓ 状态↔备注↔结论一致</span>
                ) : (
                  <span className="text-warn-500 font-medium animate-pulse-soft inline-flex items-center gap-1">
                    ⚠ 不一致需核对
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
