import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClipStore } from '@/store/clipStore';
import type { ClipStatus } from 'shared/types';
import { STATUS_CONFIG } from 'shared/constants';
import ClipCard from '@/components/ClipCard';
import { Search, Plus, Filter, FileOutput } from 'lucide-react';

const ClipList: React.FC = () => {
  const navigate = useNavigate();
  const { clips, loading, fetchClips, filters, setFilters, selectedClipIds, clearSelection } =
    useClipStore();
  const [searchValue, setSearchValue] = useState(filters.keyword || '');

  const fetchClipsCallback = useCallback(fetchClips, [fetchClips]);

  useEffect(() => {
    fetchClipsCallback();
  }, [filters, fetchClipsCallback]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, keyword: searchValue.trim() || undefined });
  };

  const handleStatusFilter = (status?: ClipStatus) => {
    setFilters({ ...filters, status });
  };

  const allStatuses: (ClipStatus | undefined)[] = [
    undefined,
    'pending_ad_script',
    'pending_review',
    'pending',
    'ready',
    'archived',
  ];

  const statusCounts = allStatuses.reduce(
    (acc, status) => {
      acc[status || 'all'] = status
        ? clips.filter(c => c.status === status).length
        : clips.length;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-slate-850 mb-1">
            嘉宾片段列表
          </h1>
          <p className="text-studio-muted">共 {clips.length} 条记录</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedClipIds.length > 0 && (
            <>
              <span className="text-sm text-studio-muted">
                已选择 {selectedClipIds.length} 项
              </span>
              <button
                type="button"
                onClick={() => navigate('/export')}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <FileOutput className="w-4 h-4" />
                批量导出
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="btn-ghost text-sm"
              >
                取消选择
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate('/clip/new')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建片段
          </button>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-studio-muted" />
            <input
              type="text"
              className="input-field pl-10"
              placeholder="搜索标题、嘉宾、期数..."
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
            />
          </form>

          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-studio-muted mr-1" />
            {allStatuses.map(status => {
              const isActive = filters.status === status;
              const label = status ? STATUS_CONFIG[status].label : '全部';
              const count = statusCounts[status || 'all'] || 0;

              return (
                <button
                  key={status || 'all'}
                  type="button"
                  onClick={() => handleStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
                    isActive
                      ? 'bg-amber-700 text-white'
                      : 'text-studio-muted hover:bg-studio-border'
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1 ${
                      isActive ? 'text-amber-100' : 'text-studio-muted/60'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="card p-5 animate-pulse"
            >
              <div className="h-5 bg-studio-border rounded w-3/4 mb-3" />
              <div className="h-4 bg-studio-border rounded w-1/2 mb-3" />
              <div className="h-8 bg-studio-border rounded w-full" />
            </div>
          ))}
        </div>
      ) : clips.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clips.map(clip => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-studio-border flex items-center justify-center">
            <Search className="w-8 h-8 text-studio-muted" />
          </div>
          <h3 className="font-serif text-lg font-medium text-slate-850 mb-2">
            暂无匹配的记录
          </h3>
          <p className="text-studio-muted mb-4">
            尝试调整筛选条件或搜索关键词
          </p>
          <button
            type="button"
            onClick={() => {
              setFilters({});
              setSearchValue('');
            }}
            className="btn-secondary"
          >
            重置筛选
          </button>
        </div>
      )}
    </div>
  );
};

export default ClipList;
