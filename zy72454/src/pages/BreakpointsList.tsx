import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  AlertTriangle,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { BreakpointStatus, STATUS_LABELS, STATUS_COLORS } from '../../shared/types';

const statusOptions: { value: BreakpointStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending_inspection', label: '待巡检' },
  { value: 'inspecting', label: '巡检中' },
  { value: 'pending_review', label: '待复核' },
  { value: 'confirmed', label: '已确认' },
  { value: 'completed', label: '已完成' },
];

export const BreakpointsList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = (searchParams.get('status') as BreakpointStatus) || undefined;

  const { breakpoints, fetchBreakpoints, loading } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BreakpointStatus | ''>(initialStatus || '');
  const [detourFilter, setDetourFilter] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    fetchBreakpoints({
      status: statusFilter || undefined,
      hasConstructionDetour: detourFilter,
      search: search || undefined,
    });
  }, [fetchBreakpoints, statusFilter, detourFilter, search]);

  const handleStatusChange = (val: string) => {
    const v = val as BreakpointStatus | '';
    setStatusFilter(v);
    if (v) {
      searchParams.set('status', v);
    } else {
      searchParams.delete('status');
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="搜索断点名称或位置..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-stone-400" />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={detourFilter === undefined ? '' : String(detourFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setDetourFilter(v === '' ? undefined : v === 'true');
            }}
            className="px-3 py-2.5 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">全部施工改道</option>
            <option value="true">有施工改道</option>
            <option value="false">无施工改道</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                断点名称
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                位置
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                状态
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                施工改道
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                红线图备注
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading.breakpoints ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-stone-400">
                  加载中...
                </td>
              </tr>
            ) : breakpoints.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-stone-400">
                  暂无断点数据
                </td>
              </tr>
            ) : (
              breakpoints.map((bp) => (
                <tr
                  key={bp.id}
                  className={`hover:bg-stone-50 transition-colors ${
                    bp.hasConstructionDetour ? 'bg-amber-50/30' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-stone-800">{bp.name}</div>
                    <div className="text-xs text-stone-400 font-mono">{bp.id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-600">{bp.location}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[bp.status]}`}
                    >
                      {STATUS_LABELS[bp.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {bp.hasConstructionDetour ? (
                      <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        施工改道未同步
                      </span>
                    ) : (
                      <span className="text-stone-400 text-xs">正常</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-600 max-w-xs truncate">
                    {bp.redlineNote || (
                      <span className="text-stone-400 italic">暂无备注</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/breakpoints/${bp.id}`}
                      className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      查看
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BreakpointsList;
