import { Search, Filter, Download, X, Building2, Layers } from 'lucide-react';
import { useCollisionStore } from '@/store/useCollisionStore';
import { CollisionService } from '@/services/collisionService';
import { STATUS_LABEL } from '@/types';
import type { CollisionStatus } from '@/types';
import { useEffect, useState } from 'react';

const STATUS_OPTIONS: Array<{ key: CollisionStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: '全部' },
  { key: 'PASSED', label: STATUS_LABEL.PASSED },
  { key: 'PENDING_EVIDENCE', label: STATUS_LABEL.PENDING_EVIDENCE },
  { key: 'MANUAL_REJUDGED', label: STATUS_LABEL.MANUAL_REJUDGED },
  { key: 'REJECTED', label: STATUS_LABEL.REJECTED },
];

export function FilterBar() {
  const { filters, loading, actions } = useCollisionStore();
  const setF = actions.setFilters;
  const [projects, setProjects] = useState<string[]>([]);
  const [floors, setFloors] = useState<string[]>([]);

  useEffect(() => {
    setProjects(CollisionService.projects());
    setFloors(CollisionService.floors());
  }, []);

  const reset = () => {
    setF({ status: 'ALL', coordinateOffsetOnly: false, keyword: '', project: '', floor: '' });
  };

  const hasActive = filters.status !== 'ALL' || filters.coordinateOffsetOnly || filters.keyword || filters.project || filters.floor;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-600 text-sm font-semibold">
          <Filter className="w-4 h-4" />
          <span>筛选条件</span>
        </div>

        <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
          {STATUS_OPTIONS.map((op) => {
            const active = filters.status === op.key;
            return (
              <button
                key={op.key}
                onClick={() => setF({ status: op.key })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all
                  ${active ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-brand-600'}`}
              >
                {op.label}
              </button>
            );
          })}
        </div>

        <label className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer transition-all
          ${filters.coordinateOffsetOnly ? 'bg-status-rejected/10 border-status-rejected/40 text-status-rejected' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'}`}>
          <input
            type="checkbox"
            className="w-3.5 h-3.5 accent-status-rejected"
            checked={!!filters.coordinateOffsetOnly}
            onChange={(e) => setF({ coordinateOffsetOnly: e.target.checked })}
          />
          <span>⚠ 仅看坐标偏移异常</span>
        </label>

        <div className="flex-1 flex items-center gap-2 justify-end flex-wrap">
          <div className="relative">
            <Building2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filters.project || ''}
              onChange={(e) => setF({ project: e.target.value || undefined })}
              className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 appearance-none cursor-pointer"
            >
              <option value="">全部项目</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Layers className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filters.floor || ''}
              onChange={(e) => setF({ floor: e.target.value || undefined })}
              className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 appearance-none cursor-pointer"
            >
              <option value="">全部楼层</option>
              {floors.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.keyword || ''}
              onChange={(e) => setF({ keyword: e.target.value })}
              placeholder="搜索编号/构件/负责人..."
              className="pl-8 pr-3 py-1.5 w-56 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:bg-white transition"
            />
          </div>

          {hasActive && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-status-rejected hover:bg-status-rejected/5 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>重置</span>
            </button>
          )}

          <button
            onClick={() => actions.exportCSV()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 active:bg-brand-700 rounded-lg shadow-sm shadow-brand-500/25 transition-colors disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 CSV 明细</span>
          </button>
        </div>
      </div>
    </div>
  );
}
