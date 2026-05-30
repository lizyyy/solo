import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterPanel } from '@/components/export/FilterPanel';
import { ExportPreview } from '@/components/export/ExportPreview';
import { useRecordStore } from '@/store/useRecordStore';

export const ExportPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    filters,
    isLoading,
    loadRecords,
    setFilters,
    getFilteredRecords,
  } = useRecordStore();

  const filteredRecords = getFilteredRecords();

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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Download size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold font-mono tracking-wider text-purple-400">
                  数据导出
                </h1>
                <p className="text-[10px] text-gray-500 font-mono">
                  DATA EXPORT
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
              className="px-4 py-2 rounded-lg text-xs font-mono text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
            >
              实验报告
            </button>
            <button
              onClick={() => navigate('/export')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-mono transition-all',
                'bg-purple-500/20 text-purple-400 border border-purple-500/40'
              )}
            >
              数据导出
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4">
            <FilterPanel
              resultTypes={filters.resultTypes}
              errorTypes={filters.errorTypes}
              search={filters.search}
              onResultTypeChange={(types) => setFilters({ resultTypes: types })}
              onErrorTypeChange={(types) => setFilters({ errorTypes: types })}
              onSearchChange={(search) => setFilters({ search })}
              onClearFilters={handleClearFilters}
            />

            <div className="mt-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
              <h4 className="text-xs text-gray-400 font-mono mb-3 tracking-wider">导出说明</h4>
              <div className="space-y-2 text-[11px] text-gray-500 font-mono leading-relaxed">
                <p>📌 <span className="text-gray-400">CSV格式：</span>适合在Excel中分析，包含所有核心字段。</p>
                <p>📌 <span className="text-gray-400">JSON格式：</span>包含完整的轨迹数据和备注版本历史。</p>
                <p>📌 <span className="text-gray-400">错误标记：</span>导出数据会保留所有异常标记，便于后续复核。</p>
                <p>📌 <span className="text-gray-400">备注版本：</span>所有历史备注版本都会被导出，不会丢失任何修改记录。</p>
              </div>
            </div>
          </div>

          <div className="col-span-8">
            <div className="p-6 bg-gray-900/50 rounded-xl border border-gray-800">
              {isLoading ? (
                <div className="text-center py-16">
                  <div className="animate-spin w-8 h-8 border-2 border-gray-700 border-t-purple-500 rounded-full mx-auto mb-2" />
                  <p className="text-gray-500 font-mono text-xs">加载中...</p>
                </div>
              ) : (
                <ExportPreview records={filteredRecords} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
