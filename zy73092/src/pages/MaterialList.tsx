import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, RefreshCw, Pause, Edit3, Filter, ChevronDown, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import SummaryCards from '@/components/SummaryCards';
import StatusBadge from '@/components/StatusBadge';
import Empty from '@/components/Empty';
import { useTrackerStore } from '@/store/useTrackerStore';
import { fetcher } from '@/utils/fetcher';
import type { Material, SummaryStat, Specialty, MaterialStatus } from '@/shared/types';

const specialtyLabels: Record<Specialty, string> = {
  HVAC: '暖通',
  ELECTRICAL: '电气',
  PLUMBING: '给排水',
  FIRE: '消防',
};

const statusOptions: Array<{ value: MaterialStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PROCESSED', label: '已处理' },
  { value: 'PENDING', label: '待改判' },
  { value: 'SUSPENDED', label: '批次挂起' },
  { value: 'MISSING', label: '缺材料' },
  { value: 'AWAITING_PM', label: '待PM确认' },
];

const specialtyOptions: Array<{ value: Specialty | 'ALL'; label: string }> = [
  { value: 'ALL', label: '全部专业' },
  { value: 'HVAC', label: '暖通' },
  { value: 'ELECTRICAL', label: '电气' },
  { value: 'PLUMBING', label: '给排水' },
  { value: 'FIRE', label: '消防' },
];

export default function MaterialList() {
  const navigate = useNavigate();
  const filter = useTrackerStore((s) => s.filter);
  const setFilter = useTrackerStore((s) => s.setFilter);

  const [summary, setSummary] = useState<SummaryStat | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [specialtyDropdownOpen, setSpecialtyDropdownOpen] = useState(false);

  const loadSummary = async () => {
    setSummaryLoading(true);
    const res = await fetcher.get<SummaryStat>('/api/materials/summary');
    if (res.success && res.data) {
      setSummary(res.data);
    }
    setSummaryLoading(false);
  };

  const loadMaterials = async () => {
    setListLoading(true);
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '100');
    if (filter.status !== 'ALL') params.set('status', filter.status);
    if (filter.specialty !== 'ALL') params.set('specialty', filter.specialty);
    if (filter.search) params.set('search', filter.search);

    const res = await fetcher.get<Material[]>(`/api/materials?${params.toString()}`);
    if (res.success && res.items) {
      setMaterials(res.items);
    } else {
      setMaterials([]);
    }
    setListLoading(false);
  };

  const refreshAll = () => {
    loadSummary();
    loadMaterials();
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [filter.status, filter.specialty, filter.search]);

  useEffect(() => {
    const handleClick = () => {
      setStatusDropdownOpen(false);
      setSpecialtyDropdownOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const isHighlightRow = (status: MaterialStatus) =>
    status === 'SUSPENDED' || status === 'MISSING' || status === 'AWAITING_PM';

  const handleRerun = async (id: number) => {
    if (!window.confirm('确认重跑该材料？旧处理意见将被标记为历史。')) return;
    const res = await fetcher.post(`/api/materials/${id}/rerun`, { operator: '老叶' });
    if (res.success) {
      refreshAll();
    } else {
      alert(res.error || '重跑失败');
    }
  };

  const handleSuspend = async (id: number) => {
    const res = await fetcher.post('/api/suspends', {
      materialId: id,
      reason: '材料批次待确认',
      createdBy: '老叶',
    });
    if (res.success) {
      refreshAll();
    } else {
      alert(res.error || '挂起失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">材料追踪列表</h1>
          <p className="text-sm text-slate-500 mt-1">管理机电管综材料的送审状态、批次信息和判定记录</p>
        </div>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-16 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-12" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <SummaryCards data={summary} />
      ) : null}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center text-xs text-slate-500 font-medium mr-2">
            <Filter className="w-4 h-4 mr-1.5" />
            筛选条件
          </div>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setStatusDropdownOpen(!statusDropdownOpen);
                setSpecialtyDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors min-w-[140px]"
            >
              <span className="text-slate-700">
                {statusOptions.find((o) => o.value === filter.status)?.label}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', statusDropdownOpen && 'rotate-180')} />
            </button>
            {statusDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-30">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setFilter({ status: opt.value });
                      setStatusDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center px-3.5 py-2 text-sm hover:bg-slate-50 text-left',
                      filter.status === opt.value ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                    )}
                  >
                    {opt.label}
                    {filter.status === opt.value && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setSpecialtyDropdownOpen(!specialtyDropdownOpen);
                setStatusDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors min-w-[140px]"
            >
              <span className="text-slate-700">
                {specialtyOptions.find((o) => o.value === filter.specialty)?.label}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', specialtyDropdownOpen && 'rotate-180')} />
            </button>
            {specialtyDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-30">
                {specialtyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setFilter({ specialty: opt.value });
                      setSpecialtyDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center px-3.5 py-2 text-sm hover:bg-slate-50 text-left',
                      filter.specialty === opt.value ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                    )}
                  >
                    {opt.label}
                    {filter.specialty === opt.value && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[240px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索材料编号、名称、送审编号..."
                value={filter.search}
                onChange={(e) => setFilter({ search: e.target.value })}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          {(filter.status !== 'ALL' || filter.specialty !== 'ALL' || filter.search) && (
            <button
              onClick={() => setFilter({ status: 'ALL', specialty: 'ALL', search: '' })}
              className="text-xs text-slate-500 hover:text-rose-600 transition-colors px-2 py-1"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {listLoading ? (
          <div className="py-16 text-center text-slate-400">加载中...</div>
        ) : materials.length === 0 ? (
          <div className="py-16">
            <Empty />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="text-left font-semibold px-5 py-3.5">材料编号</th>
                  <th className="text-left font-semibold px-5 py-3.5">名称 / 规格</th>
                  <th className="text-left font-semibold px-5 py-3.5">专业</th>
                  <th className="text-left font-semibold px-5 py-3.5">批次状态</th>
                  <th className="text-left font-semibold px-5 py-3.5">判定结果</th>
                  <th className="text-left font-semibold px-5 py-3.5">确认状态</th>
                  <th className="text-left font-semibold px-5 py-3.5">最新导出</th>
                  <th className="text-right font-semibold px-5 py-3.5 pr-6">操作</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m, idx) => {
                  const highlight = isHighlightRow(m.status);
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        'border-b border-slate-100 transition-colors hover:bg-slate-50/60',
                        idx % 2 === 1 && 'bg-slate-50/30',
                        highlight && 'border-l-4 border-l-rose-500 bg-rose-50/50 hover:bg-rose-50/70'
                      )}
                    >
                      <td className="px-5 py-4">
                        <code className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded font-semibold">
                          {m.code}
                        </code>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{m.spec}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{m.submissionNo}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {specialtyLabels[m.specialty]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {!m.hasMissingBatch ? (
                            <>
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                              <span className="text-slate-700 text-xs font-medium">完整</span>
                            </>
                          ) : (
                            <>
                              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </span>
                              <span className="text-rose-600 text-xs font-medium">批次缺失</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {m.judgeResult ? (
                          <StatusBadge judgeResult={m.judgeResult} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-5 py-4">
                        {m.isLatestExport ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded">
                            <Sparkles className="w-3 h-3" />
                            最新
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/material/${m.id}`)}
                            className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/material/${m.id}`)}
                            className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="改判"
                            disabled={highlight}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRerun(m.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="重跑"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSuspend(m.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="挂起"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
