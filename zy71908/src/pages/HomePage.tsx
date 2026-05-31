import React from 'react';
import { useArchiveStore } from '../store/archiveStore';
import { ArchiveCard } from '../components/ArchiveCard';
import { FilterPanel } from '../components/FilterPanel';
import { StatsOverviewBar } from '../components/StatsOverview';
import { ErrorToast } from '../components/ErrorToast';
import { DuplicateDialog } from '../components/DuplicateDialog';
import { UrlStateSync } from '../services/UrlStateSync';
import type { DuplicateResult } from '../types';
import { Archive, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const {
    isLoading,
    error,
    clearError,
    getFilteredRecords,
    getPaginatedRecords,
    filterState,
    setFilterState,
    stats,
    duplicates,
    students,
  } = useArchiveStore();

  const [filterOpen, setFilterOpen] = React.useState(true);
  const [selectedDuplicate, setSelectedDuplicate] = React.useState<DuplicateResult | null>(null);


  const filteredRecords = getFilteredRecords();
  const { items, total } = getPaginatedRecords();
  const { page, pageSize } = filterState;
  const totalPages = Math.ceil(total / pageSize);

  const student = filterState.studentId
    ? students.find(s => s.id === filterState.studentId)
    : undefined;

  const rangeDescription = UrlStateSync.getRangeDescription(
    filterState,
    total,
    student?.name
  );

  const handleExport = () => {
    if (filteredRecords.length === 0) return;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-neutral-500 text-sm">正在加载归档数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-primary-50/30">
      {error && <ErrorToast error={error} onClose={clearError} />}

      <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Archive className="w-6 h-6 text-primary-600" />
              <h1 className="font-serif text-lg font-bold text-neutral-900">编曲素材归档</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/export"
                className="btn-secondary text-sm flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                导出排练小结
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <StatsOverviewBar stats={stats} />
        </div>

        {duplicates.length > 0 && (
          <div className="mb-4 p-3 bg-warning-50 border border-warning-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-warning-800">
              <span className="font-medium">⚠ 发现 {duplicates.length} 组重复记录</span>
              <span className="text-warning-600">需要处理以确保数据准确</span>
            </div>
            <button
              onClick={() => setSelectedDuplicate(duplicates[0])}
              className="text-sm text-warning-700 hover:text-warning-800 font-medium underline"
            >
              查看详情
            </button>
          </div>
        )}

        <div className="flex gap-6">
          <aside className="w-72 flex-shrink-0 hidden lg:block">
            <div className="sticky top-20">
              <FilterPanel isOpen={filterOpen} onToggle={() => setFilterOpen(!filterOpen)} />
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-500">{rangeDescription}</p>
              <p className="text-xs text-neutral-400">筛选结果：{total} 条</p>
            </div>

            <div className="lg:hidden mb-4">
              <FilterPanel isOpen={filterOpen} onToggle={() => setFilterOpen(!filterOpen)} />
            </div>

            {items.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-neutral-200">
                <Archive className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500 text-sm">没有找到符合条件的归档记录</p>
                <p className="text-neutral-400 text-xs mt-1">试试调整筛选条件</p>
              </div>
            ) : (
              <div className="space-y-3 animate-stagger">
                {items.map(record => (
                  <ArchiveCard key={record.id} record={record} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setFilterState({ page: page - 1 })}
                  disabled={page <= 1}
                  className="btn-secondary text-sm p-2 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="text-neutral-400 text-xs">...</span>
                      )}
                      <button
                        onClick={() => setFilterState({ page: p })}
                        className={`w-8 h-8 rounded-lg text-sm transition-colors
                          ${p === page
                            ? 'bg-primary-600 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                          }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => setFilterState({ page: page + 1 })}
                  disabled={page >= totalPages}
                  className="btn-secondary text-sm p-2 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedDuplicate && (
        <DuplicateDialog
          duplicate={selectedDuplicate}
          onClose={() => setSelectedDuplicate(null)}
        />
      )}
    </div>
  );
}
