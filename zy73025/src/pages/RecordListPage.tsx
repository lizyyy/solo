import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import QueueSidebar from '@/components/QueueSidebar';
import FilterBar, { type FilterState } from '@/components/FilterBar';
import RecordCard from '@/components/RecordCard';
import { useAppStore } from '@/store/useAppStore';
import type { RecordStatus, ExceptionType } from '@shared/types';

const DEFAULT_FILTER: FilterState = {
  status: 'all',
  keyword: '',
  startDate: '',
  endDate: '',
};

export default function RecordListPage() {
  const navigate = useNavigate();
  const { records, recordsLoading, queue, fetchRecords, fetchQueue } = useAppStore();
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selectedType, setSelectedType] = useState<ExceptionType | null>(null);

  useEffect(() => {
    fetchRecords();
    fetchQueue();
  }, [fetchRecords, fetchQueue]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchRecords({
        status: filter.status === 'all' ? undefined : (filter.status as RecordStatus),
        keyword: filter.keyword || undefined,
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined,
      });
    }, 300);
    return () => clearTimeout(debounce);
  }, [filter, fetchRecords]);

  const handleSelectType = useCallback(
    (type: ExceptionType | null) => {
      setSelectedType(type);
      if (type) {
        navigate(`/queue?type=${type}`);
      } else {
        navigate('/queue');
      }
    },
    [navigate],
  );

  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="flex min-h-screen bg-mist-50">
      <Sidebar />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="font-serif text-2xl font-bold text-mist-900 mb-2">
              温控记录列表
            </h1>
            <p className="text-mist-500 text-sm">
              查看所有异宠体温监控记录，进行复核、改判和补录操作。按更新时间倒序排列。
            </p>
          </div>

          <div className="mb-6">
            <FilterBar value={filter} onChange={setFilter} />
          </div>

          {recordsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="card animate-pulse"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-2 flex-1">
                      <div className="h-3 bg-mist-200 rounded w-1/3" />
                      <div className="h-6 bg-mist-200 rounded w-1/2" />
                    </div>
                    <div className="h-7 bg-mist-200 rounded-full w-16" />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-mist-100 rounded w-3/4" />
                    <div className="h-4 bg-mist-100 rounded w-2/3" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="h-14 bg-mist-100 rounded-lg" />
                    <div className="h-14 bg-mist-100 rounded-lg" />
                  </div>
                  <div className="h-8 bg-mist-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : sortedRecords.length === 0 ? (
            <div className="card text-center py-16">
              <p className="font-serif text-lg text-mist-700 mb-2">暂无符合条件的记录</p>
              <p className="text-sm text-mist-400">尝试调整筛选条件</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sortedRecords.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </div>
      </main>

      <QueueSidebar
        queue={queue}
        selectedType={selectedType}
        onSelectType={handleSelectType}
      />
    </div>
  );
}
