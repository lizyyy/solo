import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecordList } from '@/components/reports/RecordList';
import { RecordDetail } from '@/components/reports/RecordDetail';
import { FilterPanel } from '@/components/export/FilterPanel';
import { useRecordStore } from '@/store/useRecordStore';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    records,
    selectedRecordId,
    filters,
    isLoading,
    loadRecords,
    selectRecord,
    deleteRecord,
    setFilters,
    getFilteredRecords,
    addNoteVersion,
    updateCorrectedParams,
  } = useRecordStore();

  const filteredRecords = getFilteredRecords();
  const selectedRecord = records.find((r) => r.id === selectedRecordId) || null;

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleClearFilters = () => {
    setFilters({
      resultTypes: [],
      errorTypes: [],
      search: '',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <FileText size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold font-mono tracking-wider text-blue-400">
                  实验报告
                </h1>
                <p className="text-[10px] text-gray-500 font-mono">
                  EXPERIMENT RECORDS
                </p>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg text-xs font-mono text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
            >
              模拟实验
            </button>
            <button
              onClick={() => navigate('/reports')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-mono transition-all',
                'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              )}
            >
              实验报告
            </button>
            <button
              onClick={() => navigate('/export')}
              className="px-4 py-2 rounded-lg text-xs font-mono text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
            >
              数据导出
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4 space-y-4">
            <FilterPanel
              resultTypes={filters.resultTypes}
              errorTypes={filters.errorTypes}
              search={filters.search}
              onResultTypeChange={(types) => setFilters({ resultTypes: types })}
              onErrorTypeChange={(types) => setFilters({ errorTypes: types })}
              onSearchChange={(search) => setFilters({ search })}
              onClearFilters={handleClearFilters}
            />

            <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-300 font-mono">
                  实验记录
                </h3>
                <span className="text-[10px] text-gray-500 font-mono">
                  共 {filteredRecords.length} 条
                </span>
              </div>
              <div className="max-h-[600px] overflow-y-auto pr-2 space-y-2">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full mx-auto mb-2" />
                    <p className="text-gray-500 font-mono text-xs">加载中...</p>
                  </div>
                ) : (
                  <RecordList
                    records={filteredRecords}
                    selectedId={selectedRecordId}
                    onSelect={selectRecord}
                    onDelete={deleteRecord}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="col-span-8">
            <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800 min-h-[700px]">
              {selectedRecord ? (
                <RecordDetail
                  record={selectedRecord}
                  onUpdateCorrectedParams={updateCorrectedParams}
                  onAddNote={addNoteVersion}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[600px] text-center">
                  <FileText size={64} className="text-gray-800 mb-4" />
                  <p className="text-gray-500 font-mono text-sm">
                    选择一条记录查看详情
                  </p>
                  <p className="text-gray-600 font-mono text-xs mt-1">
                    原始参数、修正参数和最终结论将分开显示，便于复核
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
