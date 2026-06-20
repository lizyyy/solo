import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Search, Filter, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScheduleStore } from '@/store/useScheduleStore';
import { formatDate, formatStatus, statusColor } from '@/utils/formatters';
import type { ScheduleAggregate, ScheduleStatus } from '@/types/schedule';

const statusBarColor: Record<ScheduleStatus, string> = {
  confirmed: 'bg-green-500',
  pending: 'bg-amber-500',
  withdrawn: 'bg-gray-400',
  draft: 'bg-slate-400',
};

const statusOptions: Array<{ value: 'all' | ScheduleStatus; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'confirmed', label: '已确认' },
  { value: 'pending', label: '待确认' },
  { value: 'withdrawn', label: '已撤回' },
  { value: 'draft', label: '草稿' },
];

function StatusBadge({ status }: { status: ScheduleStatus }) {
  const color = statusColor(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        color.bg,
        color.text,
        color.border,
      )}
    >
      {formatStatus(status)}
    </span>
  );
}

function VersionPills({ agg }: { agg: ScheduleAggregate }) {
  if (agg.versions.length <= 1 && agg.withdrawnCount <= 0) return null;
  return (
    <div className="flex items-center gap-2">
      {agg.versions.length > 1 && (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          v1-v{agg.versions.length}
        </span>
      )}
      {agg.withdrawnCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          含{agg.withdrawnCount}条撤回
        </span>
      )}
    </div>
  );
}

function VersionsTable({ agg }: { agg: ScheduleAggregate }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5 font-medium">版本 ID</th>
            <th className="px-4 py-2.5 font-medium">版本号</th>
            <th className="px-4 py-2.5 font-medium">状态</th>
            <th className="px-4 py-2.5 font-medium">提交时间</th>
            <th className="px-4 py-2.5 font-medium">备注</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {agg.versions.map((v) => {
            const isWithdrawn = v.status === 'withdrawn';
            return (
              <tr
                key={v.id}
                className={cn(
                  'transition-colors hover:bg-slate-50',
                  isWithdrawn && 'bg-gray-50/60 opacity-60',
                )}
              >
                <td className={cn('px-4 py-2.5 font-mono text-xs text-slate-600', isWithdrawn && 'line-through')}>
                  {v.id}
                </td>
                <td className={cn('px-4 py-2.5 tabular-nums text-slate-700', isWithdrawn && 'line-through')}>
                  v{v.version}
                </td>
                <td className={cn('px-4 py-2.5', isWithdrawn && 'line-through')}>
                  <StatusBadge status={v.status} />
                </td>
                <td className={cn('px-4 py-2.5 text-slate-600', isWithdrawn && 'line-through')}>
                  {formatDate(v.submittedAt)}
                </td>
                <td className={cn('px-4 py-2.5 max-w-xs truncate text-slate-600', isWithdrawn && 'line-through')}>
                  {v.manualRemark || <span className="text-slate-400">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ keyword }: { keyword: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <Search className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-medium text-slate-700">未找到匹配的排程记录</h3>
      <p className="mt-1 text-sm text-slate-500">
        搜索关键词「<span className="font-medium text-slate-700">{keyword}</span>」无结果，请尝试其他管线号、备件名称或型号
      </p>
    </div>
  );
}

export default function DedupList() {
  const {
    filteredAggregates,
    filterStatus,
    searchKeyword,
    setFilterStatus,
    setSearchKeyword,
  } = useScheduleStore((state) => ({
    filteredAggregates: state.filteredAggregates(),
    filterStatus: state.filterStatus,
    searchKeyword: state.searchKeyword,
    setFilterStatus: state.setFilterStatus,
    setSearchKeyword: state.setSearchKeyword,
  }));

  const [expandedBizKeys, setExpandedBizKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (bizKey: string) => {
    setExpandedBizKeys((prev) => {
      const next = new Set(prev);
      if (next.has(bizKey)) {
        next.delete(bizKey);
      } else {
        next.add(bizKey);
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl bg-white shadow-card border border-slate-100 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | ScheduleStatus)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 appearance-none focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:w-40"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 sm:min-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="管线号/备件名/型号"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
        <div className="text-xs text-slate-500">
          共 <span className="font-semibold text-slate-700 tabular-nums">{filteredAggregates.length}</span> 条
        </div>
      </div>

      {filteredAggregates.length === 0 ? (
        <EmptyState keyword={searchKeyword} />
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredAggregates.map((agg) => {
            const isExpanded = expandedBizKeys.has(agg.bizKey);
            const detailHref = `/schedule/${encodeURIComponent(agg.bizKey)}`;
            return (
              <div key={agg.bizKey} className="group">
                <div className="flex">
                  <div className={cn('w-1 flex-shrink-0', statusBarColor[agg.latest.status])} />
                  <div className="flex flex-1 flex-col">
                    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1.1fr_1.4fr_0.9fr_0.8fr_0.9fr_1.3fr_1.1fr] md:items-center md:gap-4">
                      <div className="font-mono text-sm text-slate-900 tracking-tight">
                        {agg.latest.pipelineNo}
                      </div>
                      <div className="flex flex-col text-sm">
                        <span className="font-medium text-slate-900">{agg.latest.partName}</span>
                        <span className="text-xs text-slate-500 font-mono mt-0.5">{agg.latest.partModel}</span>
                      </div>
                      <div className="text-sm text-slate-700 tabular-nums">
                        {agg.latest.planDate}
                      </div>
                      <div className="text-sm text-slate-700">
                        {agg.latest.submitter}
                      </div>
                      <div>
                        <StatusBadge status={agg.latest.status} />
                      </div>
                      <div>
                        <VersionPills agg={agg} />
                      </div>
                      <div className="flex items-center gap-2 md:justify-end">
                        <Link
                          to={detailHref}
                          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                        >
                          查看详情
                        </Link>
                        {agg.versions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(agg.bizKey)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <>
                                收起版本
                                <ChevronUp className="h-4 w-4" />
                              </>
                            ) : (
                              <>
                                展开版本
                                <ChevronDown className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {isExpanded && agg.versions.length > 1 && (
                      <div className="px-4 pb-4 pl-8 md:pl-8 animate-expand">
                        <VersionsTable agg={agg} />
                      </div>
                    )}
                    {agg.latest.status === 'pending' && agg.latest.modelReplace && (
                      <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50/70 px-3 py-2 text-xs">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-orange-700">型号替换待确认</span>
                          <span className="mx-1.5 text-orange-300">·</span>
                          <span className="font-mono text-orange-700">{agg.latest.modelReplace.oldModel}</span>
                          <ArrowLeftRight className="mx-1 inline h-3 w-3 text-orange-400" />
                          <span className="font-mono font-semibold text-orange-800">{agg.latest.modelReplace.newModel}</span>
                          <p className="mt-0.5 text-slate-600">原因：{agg.latest.modelReplace.reason}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
