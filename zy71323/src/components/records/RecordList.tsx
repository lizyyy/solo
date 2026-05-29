import { useEffect, useState, useMemo } from 'react';
import { Search, SortDesc, SortAsc, RefreshCw, FileText, Filter, X } from 'lucide-react';
import type { EstimationRecord, RecordStatus } from '@/types';
import { useRecordStore } from '@/store/useRecordStore';
import { RecordCard } from './RecordCard';
import { cn } from '@/lib/utils';

interface RecordListProps {
  onViewRecord: (record: EstimationRecord) => void;
  onContinueRecord: (id: string) => void;
}

type SortField = 'createdAt' | 'totalEnergy' | 'status';
type SortOrder = 'asc' | 'desc';
type StatusFilter = RecordStatus | 'all';

export function RecordList({ onViewRecord, onContinueRecord }: RecordListProps) {
  const { records, isLoading, loadRecords, search, searchQuery, comparisonScenarios, clearComparison } = useRecordStore();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    const timer = setTimeout(() => {
      search(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'totalEnergy':
          comparison = (a.result?.totalEnergy || 0) - (b.result?.totalEnergy || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [records, sortField, sortOrder, statusFilter]);

  const statusCounts = useMemo(() => {
    return records.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    }, {} as Record<StatusFilter, number>);
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-tech-400" />
            估算记录
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-ocean-700 text-ocean-300 text-xs">
            {records.length} 条记录
          </span>
        </div>
        <button
          onClick={() => loadRecords()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ocean-700 hover:bg-ocean-600 text-ocean-200 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {comparisonScenarios.length > 0 && (
        <div className="bg-tech-500/10 border border-tech-500/30 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-tech-400" />
              <span className="text-sm text-tech-400 font-medium">对比模式</span>
              <span className="px-2 py-0.5 rounded-full bg-tech-500/20 text-tech-400 text-xs">
                {comparisonScenarios.length}/4 个场景
              </span>
            </div>
            <button
              onClick={clearComparison}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-ocean-700 text-ocean-400 text-xs transition-colors"
            >
              <X className="w-3 h-3" />
              清除对比
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {comparisonScenarios.map(scenario => (
              <div
                key={scenario.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ocean-800/50 border"
                style={{ borderColor: scenario.color }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scenario.color }} />
                <span className="text-sm text-ocean-200">{scenario.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ocean-500" />
          <input
            type="text"
            value={localSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="搜索记录ID、备注..."
            className="w-full pl-10 pr-4 py-2.5 bg-ocean-700/50 border border-ocean-600 rounded-lg text-ocean-100 placeholder-ocean-500 text-sm focus:outline-none focus:border-tech-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setLocalSearch('');
                search('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-ocean-600 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-ocean-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
            className="px-3 py-2.5 bg-ocean-700/50 border border-ocean-600 rounded-lg text-ocean-100 text-sm focus:outline-none focus:border-tech-500/50 transition-colors"
          >
            <option value="createdAt">创建时间</option>
            <option value="totalEnergy">总能量</option>
            <option value="status">状态</option>
          </select>
          <button
            onClick={toggleSortOrder}
            className="p-2.5 bg-ocean-700/50 border border-ocean-600 rounded-lg text-ocean-300 hover:text-white hover:border-tech-500/50 transition-colors"
            title={sortOrder === 'asc' ? '升序' : '降序'}
          >
            {sortOrder === 'asc' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'valid', 'invalid', 'draft'] as StatusFilter[]).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors',
              statusFilter === status
                ? 'bg-tech-500/20 text-tech-400 border border-tech-500/30'
                : 'bg-ocean-700/50 text-ocean-300 border border-ocean-600 hover:border-ocean-500'
            )}
          >
            {status === 'all' ? '全部' : status === 'valid' ? '有效' : status === 'invalid' ? '无效' : '草稿'}
            <span className="ml-1.5 text-xs opacity-70">({statusCounts[status] || 0})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-12">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-tech-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-ocean-300 text-sm">加载记录中...</p>
          </div>
        </div>
      ) : filteredAndSortedRecords.length === 0 ? (
        <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-12">
          <div className="text-center">
            <FileText className="w-12 h-12 text-ocean-500 mx-auto mb-4 opacity-50" />
            <p className="text-ocean-300 text-sm">暂无记录</p>
            <p className="text-ocean-500 text-xs mt-1">完成估算并保存后将显示在这里</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAndSortedRecords.map((record, index) => (
            <div key={record.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
              <RecordCard
                record={record}
                onView={onViewRecord}
                onContinue={onContinueRecord}
                onDelete={() => loadRecords()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
