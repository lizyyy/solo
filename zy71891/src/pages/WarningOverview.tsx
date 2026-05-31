import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import WarningFilter from '../components/warning/WarningFilter';
import WarningList from '../components/warning/WarningList';
import BatchToolbar from '../components/warning/BatchToolbar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useWarningStore } from '../store/useWarningStore';
import { useViewStore } from '../store/useViewStore';
import { useBatchStore } from '../store/useBatchStore';
import { FilterOptions } from '../types';
import { saveScrollPosition, getScrollPosition, saveFilters, getFilters } from '../utils/viewState';

export default function WarningOverview() {
  const [showFilter, setShowFilter] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const { warnings, filteredWarnings, loading, fetchWarnings, refreshWarnings, setFilters } =
    useWarningStore();
  const {
    selectedIds,
    toggleSelectedId,
    selectAll,
    clearSelection,
    batchProcessing,
    batchProgress,
    batchTotal,
    setBatchProgress,
    setBatchProcessing,
  } = useViewStore();
  const { batchAnalyze, batchConfirm, lastResult, clearLastResult } = useBatchStore();

  useEffect(() => {
    const savedFilters = getFilters('overview');
    if (Object.keys(savedFilters).length > 0) {
      setFilters(savedFilters);
    }
    fetchWarnings();
  }, [fetchWarnings, setFilters]);

  useEffect(() => {
    const savedScroll = getScrollPosition('overview');
    if (savedScroll > 0) {
      window.scrollTo(0, savedScroll);
    }
  }, [warnings]);

  useEffect(() => {
    if (lastResult) {
      setNotification({
        type: lastResult.success ? 'success' : 'error',
        message: lastResult.message,
      });
      const timer = setTimeout(() => {
        setNotification(null);
        clearLastResult();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastResult, clearLastResult]);

  const handleScroll = useCallback(() => {
    saveScrollPosition('overview', window.scrollY);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleRefresh = () => {
    const currentScroll = window.scrollY;
    refreshWarnings();
    setTimeout(() => {
      window.scrollTo(0, currentScroll);
    }, 100);
  };

  const handleRestart = () => {
    if (confirm('确定要重启吗？当前屏幕范围将被保留。')) {
      const currentScroll = window.scrollY;
      const currentFilters = useWarningStore.getState().filters;
      refreshWarnings();
      setTimeout(() => {
        window.scrollTo(0, currentScroll);
        if (Object.keys(currentFilters).length > 0) {
          setFilters(currentFilters);
        }
      }, 100);
    }
  };

  const handleFilterApply = (filters: FilterOptions) => {
    saveFilters('overview', filters);
    setFilters(filters);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredWarnings.length) {
      clearSelection();
    } else {
      selectAll(filteredWarnings.map(w => w.id));
    }
  };

  const handleBatchAnalyze = async () => {
    const selectedWarnings = filteredWarnings.filter(w => selectedIds.includes(w.id));
    setBatchProcessing(true);
    
    await batchAnalyze(selectedWarnings, (current, total) => {
      setBatchProgress(current, total);
    });
    
    setBatchProcessing(false);
  };

  const handleBatchConfirm = async () => {
    setBatchProcessing(true);
    
    await batchConfirm(selectedIds, (current, total) => {
      setBatchProgress(current, total);
    });
    
    setBatchProcessing(false);
    clearSelection();
  };

  const statusCounts = {
    normal: warnings.filter(w => w.status === 'normal').length,
    warning: warnings.filter(w => w.status === 'warning').length,
    fault: warnings.filter(w => w.status === 'fault').length,
  };

  return (
    <div className="flex min-h-screen bg-[#0f1219]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title="预警总览"
          subtitle={`共 ${warnings.length} 条预警记录，其中故障 ${statusCounts.fault} 条，预警 ${statusCounts.warning} 条`}
          onRefresh={handleRefresh}
          onRestart={handleRestart}
          showFilter={true}
          onFilterClick={() => setShowFilter(!showFilter)}
        />

        <main className="flex-1 p-6">
          {notification && (
            <div
              className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${
                notification.type === 'success'
                  ? 'bg-green-900/20 border-green-700/50 text-green-400'
                  : notification.type === 'error'
                  ? 'bg-red-900/20 border-red-700/50 text-red-400'
                  : 'bg-blue-900/20 border-blue-700/50 text-blue-400'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : notification.type === 'error' ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
              <span>{notification.message}</span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-900/30 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{statusCounts.fault}</p>
                  <p className="text-xs text-gray-500">故障</p>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-900/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{statusCounts.warning}</p>
                  <p className="text-xs text-gray-500">预警</p>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-900/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{statusCounts.normal}</p>
                  <p className="text-xs text-gray-500">正常</p>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900/30 rounded-lg">
                  <Info className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{warnings.length}</p>
                  <p className="text-xs text-gray-500">总计</p>
                </div>
              </div>
            </div>
          </div>

          {showFilter && (
            <WarningFilter
              filters={useWarningStore.getState().filters}
              onApply={handleFilterApply}
              onClose={() => setShowFilter(false)}
            />
          )}

          <BatchToolbar
            selectedCount={selectedIds.length}
            totalCount={filteredWarnings.length}
            batchProcessing={batchProcessing}
            batchProgress={batchProgress}
            batchTotal={batchTotal}
            onBatchAnalyze={handleBatchAnalyze}
            onBatchConfirm={handleBatchConfirm}
            onClearSelection={clearSelection}
          />

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" text="加载中..." />
            </div>
          ) : (
            <WarningList
              warnings={filteredWarnings}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectedId}
              onSelectAll={handleSelectAll}
            />
          )}
        </main>
      </div>
    </div>
  );
}
