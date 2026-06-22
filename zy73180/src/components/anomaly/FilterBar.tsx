import { useAppStore } from '@/store/appStore';
import { filterAnomalies } from '@/utils/export';
import { ANOMALY_TYPE_LABELS, STATUS_LABELS } from '@/types';
import type { AnomalyType, ProcessingStatus } from '@/types';
import { Search, X, Download } from 'lucide-react';
import { exportAnomaliesToCsv, downloadFile } from '@/utils/export';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS: AnomalyType[] = ['unit_missing', 'unit_invalid', 'boundary_sample', 'bad_data', 'calculation_error'];
const STATUS_OPTIONS: ProcessingStatus[] = ['pending', 'reviewing', 'resolved', 'ignored'];

const typeColorMap: Record<AnomalyType, { dot: string; active: string }> = {
  unit_missing: { dot: 'bg-anomaly-unit', active: 'bg-red-50 border-anomaly-unit text-anomaly-unit' },
  unit_invalid: { dot: 'bg-red-600', active: 'bg-red-50 border-red-500 text-red-700' },
  boundary_sample: { dot: 'bg-anomaly-boundary', active: 'bg-purple-50 border-anomaly-boundary text-anomaly-boundary' },
  bad_data: { dot: 'bg-anomaly-bad', active: 'bg-gray-100 border-anomaly-bad text-anomaly-bad' },
  calculation_error: { dot: 'bg-anomaly-calc', active: 'bg-amber-50 border-anomaly-calc text-anomaly-calc' },
};

export default function FilterBar() {
  const filter = useAppStore(s => s.filter);
  const toggleFilterType = useAppStore(s => s.toggleFilterType);
  const toggleFilterStatus = useAppStore(s => s.toggleFilterStatus);
  const setFilter = useAppStore(s => s.setFilter);
  const resetFilter = useAppStore(s => s.resetFilter);
  const currentRun = useAppStore(s => s.currentRun);

  const sources = currentRun
    ? Array.from(new Set(currentRun.anomalies.map(a => a.sourceInfo.source)))
    : [];

  const filtered = currentRun ? filterAnomalies(currentRun.anomalies, filter) : [];

  const hasActiveFilter =
    filter.types.length > 0 ||
    filter.statuses.length > 0 ||
    filter.sources.length > 0 ||
    filter.searchKeyword.length > 0;

  const handleExport = () => {
    if (!currentRun) return;
    const csv = exportAnomaliesToCsv(filtered, filter, currentRun);
    downloadFile(csv, `异常队列_${currentRun.name}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const toggleSource = (source: string) => {
    const sources = filter.sources.includes(source)
      ? filter.sources.filter(s => s !== source)
      : [...filter.sources, source];
    setFilter({ sources });
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-ink-400 mr-1">异常类型</span>
        {TYPE_OPTIONS.map(type => {
          const isActive = filter.types.includes(type);
          const colors = typeColorMap[type];
          return (
            <button
              key={type}
              onClick={() => toggleFilterType(type)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150',
                isActive
                  ? colors.active
                  : 'bg-white border-ink-200 text-ink-500 hover:border-ink-300'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
              {ANOMALY_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-ink-400 mr-1">处理状态</span>
        {STATUS_OPTIONS.map(status => {
          const isActive = filter.statuses.includes(status);
          return (
            <button
              key={status}
              onClick={() => toggleFilterStatus(status)}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150',
                isActive
                  ? 'bg-ink-900 border-ink-900 text-white'
                  : 'bg-white border-ink-200 text-ink-500 hover:border-ink-300'
              )}
            >
              {STATUS_LABELS[status]}
            </button>
          );
        })}

        {sources.length > 0 && (
          <>
            <span className="text-xs font-medium text-ink-400 ml-3 mr-1">来源</span>
            {sources.map(source => {
              const isActive = filter.sources.includes(source);
              return (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-150',
                    isActive
                      ? 'bg-ink-100 border-ink-400 text-ink-700'
                      : 'bg-white border-ink-200 text-ink-500 hover:border-ink-300'
                  )}
                >
                  {source}
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text"
            value={filter.searchKeyword}
            onChange={e => setFilter({ searchKeyword: e.target.value })}
            placeholder="搜索异常摘要、来源、建议..."
            className="input pl-8 py-1.5 text-xs"
          />
        </div>

        <div className="flex-1" />

        <span className="text-xs text-ink-400">
          匹配 <span className="font-semibold text-ink-700">{filtered.length}</span> 条
        </span>

        {hasActiveFilter && (
          <button onClick={resetFilter} className="btn-ghost text-xs">
            <X className="w-3.5 h-3.5 mr-1" />
            清除
          </button>
        )}

        <button onClick={handleExport} className="btn-secondary text-xs">
          <Download className="w-3.5 h-3.5 mr-1" />
          导出队列
        </button>
      </div>
    </div>
  );
}
