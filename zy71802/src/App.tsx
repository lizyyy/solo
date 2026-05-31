import React, { useState, useEffect, useCallback } from 'react';
import type { GuaranteeRecord, QueryFilters } from './types';
import { api } from './api';
import { FilterPanel } from './components/FilterPanel';
import { RecordList } from './components/RecordList';
import { RecordDetail } from './components/RecordDetail';
import { CreateRecordModal } from './components/CreateRecordModal';
import { ImportModal } from './components/ImportModal';
import { getStatusLabel, STATUS_COLORS } from './types';

function App() {
  const [records, setRecords] = useState<GuaranteeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState<QueryFilters>({});
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<GuaranteeRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getRecords(filters, page, pageSize);
      setRecords(result.records);
      setTotal(result.total);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (e: any) {
      console.error('加载统计数据失败', e);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadStats();
  }, [loadRecords, loadStats]);

  const handleFilterChange = (newFilters: QueryFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleSelectRecord = (record: GuaranteeRecord) => {
    setSelectedRecord(record);
  };

  const handleRefresh = () => {
    loadRecords();
    loadStats();
  };

  const handleExportCSV = () => {
    api.exportCSV(filters);
  };

  const handleExportReviewList = () => {
    api.exportReviewList();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">保证函额度排队</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                记录来源、状态、修改留痕，保证重复导入、撤回修正、筛选后出口径一致
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                onClick={() => setShowCreateModal(true)}
              >
                <span>+</span> 新增记录
              </button>
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => setShowImportModal(true)}
              >
                批量导入
              </button>
              <button
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
                onClick={handleExportReviewList}
              >
                导出复核清单
              </button>
              <button
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                onClick={handleExportCSV}
              >
                导出CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      {stats && (
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-sm text-gray-500">总记录数</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
            </div>
            {Object.entries(stats.byStatus || {}).map(([status, data]) => (
              <div key={status} className="bg-white rounded-lg shadow p-3">
                <div className="text-sm text-gray-500">{(data as any).label}</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{(data as any).count}</div>
              </div>
            ))}
            <div className="bg-red-50 rounded-lg shadow p-3 border border-red-100">
              <div className="text-sm text-red-600">疑似重复</div>
              <div className="text-2xl font-bold text-red-700 mt-1">{stats.duplicates}</div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-full mx-auto px-4 pb-8">
        <FilterPanel filters={filters} onChange={handleFilterChange} />

        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">
            {loading ? (
              <span>加载中...</span>
            ) : (
              <span>共 {total} 条记录</span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {page} / {totalPages} 页
              </span>
              <button
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </div>

        <RecordList
          records={records}
          selectedId={selectedRecord?.id || null}
          onSelect={handleSelectRecord}
        />

        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">使用说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-800 mb-2">核心功能：</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>重复导入检测</strong>：系统自动检测保证函编号+客户+金额一致的重复授信，标记为【待复核】</li>
                <li><strong>操作留痕</strong>：所有状态变更、修改都记录操作人、时间、原因，可追溯</li>
                <li><strong>撤回修正</strong>：已处理的记录可撤回重新处理，必须填写原因</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-2">状态说明：</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <span key={status} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
                    {getStatusLabel(status as any)}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                导出的复核清单包含待处理和待复核记录，下一班同事可直接使用，不必再翻聊天记录
              </p>
            </div>
          </div>
        </div>
      </main>

      {selectedRecord && (
        <RecordDetail
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onRefresh={handleRefresh}
        />
      )}

      {showCreateModal && (
        <CreateRecordModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRefresh}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={handleRefresh}
        />
      )}
    </div>
  );
}

export default App;
