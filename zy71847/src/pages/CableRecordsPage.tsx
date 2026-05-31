import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, FileOutput, Check, Square, Trash2, AlertTriangle } from 'lucide-react';
import { useCableStore } from '@/store/cableStore';
import { FilterPanel } from '@/components/common/FilterPanel';
import { RecordCard } from '@/components/cable/RecordCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { STATUS_LABELS, CableStatus } from '@/types';
import { getStatistics } from '@/utils/exportGenerator';

export const CableRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { records, filters, setFilters, selectedRecordIds, toggleRecordSelection, clearSelection, getFilteredRecords, batchUpdateStatus } = useCableStore();
  const [showBatchMenu, setShowBatchMenu] = useState(false);

  const filteredRecords = useMemo(() => getFilteredRecords(), [filters, records]);
  const stats = useMemo(() => getStatistics(records), [records]);

  const handleResetFilters = () => {
    setFilters({
      rooms: [],
      cabinets: [],
      statuses: [],
      sourceTypes: [],
      dateRange: null,
      cableTypes: [],
      searchText: '',
    });
  };

  const handleFilterByStatus = (status: CableStatus) => {
    setFilters({ statuses: filters.statuses.includes(status) ? [] : [status] });
  };

  const handleBatchUpdateStatus = (status: CableStatus) => {
    batchUpdateStatus(selectedRecordIds, status, '张伟');
    clearSelection();
    setShowBatchMenu(false);
  };

  const handleBulkExport = () => {
    navigate('/export', { state: { recordIds: selectedRecordIds.length > 0 ? selectedRecordIds : undefined } });
  };

  const StatusStatCard = ({ status, count, color }: { status: CableStatus; count: number; color: string }) => (
    <div
      onClick={() => handleFilterByStatus(status)}
      className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-card-hover ${
        filters.statuses.includes(status) ? `${color} border-current` : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <StatusBadge status={status} />
        <span className="text-2xl font-bold font-mono text-gray-800">{count}</span>
      </div>
      <p className="text-xs text-gray-500">{STATUS_LABELS[status]}记录数</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-gray-900">机房线缆穿梭管理</h1>
              <p className="text-xs text-gray-500">共 {records.length} 条记录 · 筛选后 {filteredRecords.length} 条</p>
            </div>
            <div className="flex items-center gap-3">
              {selectedRecordIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">已选 {selectedRecordIds.length} 条</span>
                  <button
                    onClick={clearSelection}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowBatchMenu(!showBatchMenu)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-industrial-800 text-white rounded-lg hover:bg-industrial-700 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      批量操作
                    </button>
                    {showBatchMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-40 z-20">
                        {(Object.keys(STATUS_LABELS) as CableStatus[]).map(status => (
                          <button
                            key={status}
                            onClick={() => handleBatchUpdateStatus(status)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <StatusBadge status={status} size="sm" />
                          </button>
                        ))}
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={handleBulkExport}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                        >
                          <FileOutput className="w-4 h-4" />
                          导出选中
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={() => navigate('/import')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-signal-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                导入数据
              </button>
              <button
                onClick={() => navigate('/export')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-industrial-800 text-white rounded-lg hover:bg-industrial-700 transition-colors"
              >
                <FileOutput className="w-4 h-4" />
                导出巡检单
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatusStatCard status="confirmed" count={stats.confirmed} color="text-signal-green" />
          <StatusStatCard status="pending" count={stats.pending} color="text-signal-orange" />
          <StatusStatCard status="manual" count={stats.manual} color="text-signal-blue" />
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {stats.hasDuplicates && <AlertTriangle className="w-4 h-4 text-signal-orange" />}
                <span className="text-sm font-medium text-gray-700">总计</span>
              </div>
              <span className="text-2xl font-bold font-mono text-gray-800">{stats.total}</span>
            </div>
            <p className="text-xs text-gray-500">
              {stats.hasFlipped && <span className="text-signal-orange mr-2">⚠️ 含翻转修正</span>}
              {stats.hasDuplicates && <span className="text-signal-orange">⚠️ 含重复待处理</span>}
            </p>
          </div>
        </div>

        <div className="flex gap-6">
          <aside className="w-72 flex-shrink-0">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onReset={handleResetFilters}
            />
          </aside>

          <div className="flex-1 min-w-0">
            {filteredRecords.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">没有找到匹配的记录</h3>
                <p className="text-sm text-gray-500 mb-4">试试调整筛选条件，或者导入新的数据</p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-sm text-signal-blue hover:bg-blue-50 rounded-lg transition-colors"
                >
                  重置筛选条件
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredRecords.map((record, index) => (
                  <div key={record.id} className="animate-slide-up" style={{ animationDelay: `${index * 30}ms` }}>
                    <RecordCard
                      record={record}
                      selected={selectedRecordIds.includes(record.id)}
                      onSelect={() => toggleRecordSelection(record.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
