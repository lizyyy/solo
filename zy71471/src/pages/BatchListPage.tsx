import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Filter, RotateCcw, Plus, FileText, BarChart3, Clock } from 'lucide-react';
import { useFilterSync } from '@/hooks/useFilterSync';
import { useBatchStore } from '@/store/useBatchStore';
import type { Batch, BatchStatus } from '@/types';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

const statusConfig: Record<BatchStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  analyzed: { label: '已分析', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  reported: { label: '已报告', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export default function BatchListPage() {
  const navigate = useNavigate();
  const { filters, applyFilters, resetFilters, filteredBatches } = useFilterSync();
  const createBatch = useBatchStore((state) => state.createBatch);
  const [startDate, setStartDate] = useState<string>(filters.dateRange?.[0] || '');
  const [endDate, setEndDate] = useState<string>(filters.dateRange?.[1] || '');
  const [searchName, setSearchName] = useState<string>(filters.studentName || '');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | ''>(filters.status || '');

  useEffect(() => {
    const dateRange = startDate && endDate ? [startDate, endDate] as [string, string] : null;
    applyFilters({
      dateRange,
      studentName: searchName || null,
      status: statusFilter || null,
    });
  }, [startDate, endDate, searchName, statusFilter, applyFilters]);

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSearchName('');
    setStatusFilter('');
    resetFilters();
  };

  const handleCreateBatch = () => {
    const newBatch = createBatch({});
    navigate(`/batches/${newBatch.id}/data`);
  };

  const handleCardClick = (batch: Batch) => {
    navigate(`/batches/${batch.id}/data`);
  };

  const hasFilters = filters.dateRange || filters.studentName || filters.status;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">批次管理</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              共 {filteredBatches.length} 个实验批次
            </p>
          </div>
          <button
            onClick={handleCreateBatch}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建批次
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索学生姓名..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as BatchStatus | '')}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="analyzed">已分析</option>
                <option value="reported">已报告</option>
              </select>
            </div>

            <button
              onClick={handleReset}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                hasFilters
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  : 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
              )}
              disabled={!hasFilters}
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          </div>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">
              {hasFilters ? '没有匹配的批次' : '暂无实验批次'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {hasFilters ? '尝试调整筛选条件或重置筛选' : '点击"新建批次"开始您的第一个实验'}
            </p>
            {!hasFilters && (
              <button
                onClick={handleCreateBatch}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新建批次
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => {
              const status = statusConfig[batch.status];
              return (
                <div
                  key={batch.id}
                  onClick={() => handleCardClick(batch)}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {batch.batchNo}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {batch.studentName || '未设置姓名'}
                      </p>
                    </div>
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', status.color)}>
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">电阻规格</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {batch.resistance !== null ? `${batch.resistance} ${batch.resistanceUnit}` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">电容规格</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {batch.capacitance !== null ? `${batch.capacitance} ${batch.capacitanceUnit}` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">实验日期</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {batch.experimentDate}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{dayjs(batch.updatedAt).format('MM-DD HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {batch.status === 'analyzed' && (
                        <BarChart3 className="w-4 h-4 text-blue-500" />
                      )}
                      {batch.status === 'reported' && (
                        <FileText className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
