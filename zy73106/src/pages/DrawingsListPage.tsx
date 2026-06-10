import { useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import StatusBadge from '@/components/StatusBadge';
import Empty from '@/components/Empty';
import { formatDate } from '@/utils/date';
import {
  Search, Filter, Eye, GitCompare, Building2, FileText,
  ChevronRight, User, Calendar,
} from 'lucide-react';
import type { DrawingStatus, Drawing, DrawingVersion } from '@/types';
import { STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const filterOptions: (DrawingStatus | 'all')[] = ['all', 'abnormal', 'reviewing', 'normal', 'closed'];

const filterLabelMap: Record<string, string> = {
  all: '全部',
  ...STATUS_LABELS,
};

const filterToneMap: Record<string, string> = {
  all: 'border-steel-500 bg-steel-700/50 text-steel-200',
  abnormal: 'border-[#C0392B] bg-[#7B241C]/40 text-[#E74C3C]',
  reviewing: 'border-[#E67E22] bg-[#784212]/40 text-[#F39C12]',
  normal: 'border-[#27AE60] bg-[#186A3B]/40 text-[#2ECC71]',
  closed: 'border-steel-500 bg-steel-700/50 text-steel-300',
};

export default function DrawingsListPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = (searchParams.get('status') as DrawingStatus | 'all') || 'all';
  const [statusFilter, setStatusFilter] = useState<DrawingStatus | 'all'>(initialStatus);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const drawings = useAppStore((s) => s.drawings);
  const versions = useAppStore((s) => s.versions);

  const filtered = useMemo(() => {
    return drawings.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hit =
          d.projectNo.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [drawings, statusFilter, query]);

  const versionsFor = (d: Drawing): DrawingVersion[] =>
    versions.filter((v) => v.drawingId === d.id)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-[#3498DB]" />
            <div>
              <h1 className="font-display text-2xl font-bold text-steel-100">
                图纸版本中心
              </h1>
              <p className="text-xs font-mono text-steel-500 mt-0.5">
                全部 {drawings.length} · 当前显示 {filtered.length}
              </p>
            </div>
          </div>
        </header>

        <section className="panel-bordered p-4 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-4 h-4 text-steel-400 mr-1" />
            {filterOptions.map((f) => {
              const active = statusFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono uppercase tracking-wider border-2 transition-all',
                    active
                      ? filterToneMap[f]
                      : 'border-steel-600 text-steel-400 hover:border-steel-500 bg-transparent',
                  )}
                >
                  {filterLabelMap[f]}
                </button>
              );
            })}
          </div>
          <div className="flex-1 lg:max-w-md relative">
            <Search className="w-4 h-4 text-steel-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目编号 / 图纸名..."
              className="w-full bg-steel-900 border-2 border-steel-600 text-steel-100 pl-9 pr-3 py-2 font-mono text-sm focus:outline-none focus:border-[#E67E22] placeholder-steel-500"
            />
          </div>
        </section>

        <section className="space-y-4">
          {filtered.length === 0 ? (
            <div className="panel p-10">
              <Empty />
              <div className="text-center text-sm font-mono text-steel-500 mt-2">
                无匹配图纸
              </div>
            </div>
          ) : (
            filtered.map((d) => {
              const vList = versionsFor(d);
              const latest = vList[0];
              const missCollision = d.metrics.collisionPoints > 0;
              const missUnq = d.metrics.unqualifiedItems > 0;
              return (
                <div
                  key={d.id}
                  onClick={() => navigate(`/drawings/${d.id}`)}
                  className="panel p-5 cursor-pointer transition-all hover:border-steel-400 hover:shadow-lg hover:translate-y-[-1px]"
                >
                  <div className="flex flex-col lg:flex-row gap-5 items-stretch">
                    <div className="flex-1 lg:max-w-sm flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="stamp-badge border-[#C0392B] text-[#E74C3C]">
                            {d.projectNo}
                          </span>
                          <StatusBadge status={d.status} size="sm" />
                        </div>
                        <h3 className="mt-3 font-display text-lg font-bold text-steel-100 leading-tight">
                          {d.name}
                        </h3>
                        <div className="mt-1.5 flex items-center gap-1 text-xs font-mono text-steel-400">
                          <Building2 className="w-3.5 h-3.5" />
                          {d.buildingName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 lg:gap-6 flex-wrap">
                      <MetricMini
                        label="碰撞"
                        value={d.metrics.collisionPoints}
                        danger={missCollision}
                      />
                      <MetricMini
                        label="不合格"
                        value={d.metrics.unqualifiedItems}
                        danger={missUnq}
                      />
                      <MetricMini label="阴影" value={d.metrics.sunShadowRisk} />
                      <MetricMini label="偏差%" value={d.metrics.volumeDeviation} />
                    </div>

                    <div className="flex items-center gap-4 lg:gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {vList.slice(0, 3).map((v, i) => (
                            <div key={v.id} className="relative">
                              <div
                                className={cn(
                                  'w-3 h-3 rounded-full border-2',
                                  i === 0
                                    ? 'bg-[#E74C3C] border-[#C0392B] shadow-[0_0_8px_rgba(231,76,60,0.6)]'
                                    : 'bg-steel-600 border-steel-500',
                                )}
                              />
                              {i === 0 && (
                                <span className="absolute -top-1 -right-1 text-[8px] font-mono uppercase px-1 py-0.5 bg-[#C0392B] text-white border border-[#E74C3C]">
                                  LATEST
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-steel-500">
                          {latest?.version}
                        </span>
                      </div>

                      <div className="space-y-1 min-w-[120px]">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-steel-400">
                          <User className="w-3 h-3" />
                          {latest?.uploadedBy}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-mono text-steel-500">
                          <Calendar className="w-3 h-3" />
                          {latest ? formatDate(latest.uploadedAt) : '-'}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/drawings/${d.id}`);
                          }}
                          className="btn-steel py-1.5 px-3 text-xs flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看详情
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/versions`);
                          }}
                          className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border-2 border-steel-600 text-steel-400 hover:bg-steel-700 flex items-center gap-1"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          版本对比
                        </button>
                      </div>

                      <ChevronRight className="w-5 h-5 text-steel-600 hidden lg:block" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-mono text-steel-500 hover:text-steel-300 uppercase tracking-wider"
          >
            ← 返回工作台
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricMini({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="text-center min-w-[52px]">
      <div className="text-[10px] font-mono uppercase text-steel-500 tracking-wider mb-1">
        {label}
      </div>
      <div
        className={cn(
          'text-xl font-display font-bold',
          danger ? 'text-[#E74C3C]' : 'text-steel-200',
        )}
      >
        {value}
      </div>
    </div>
  );
}
