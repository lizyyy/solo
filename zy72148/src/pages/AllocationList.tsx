import { useState, useEffect, useMemo } from 'react';
import { Hotel, AlertTriangle, Copy, Info, RefreshCw, Trash2 } from 'lucide-react';
import { useAllocationStore } from '@/store/useAllocationStore';
import { FilterBar } from '@/components/FilterBar';
import { DataTable } from '@/components/DataTable';
import { SourceDrawer } from '@/components/SourceDrawer';
import { ImportModal } from '@/components/ImportModal';
import { ConflictModal } from '@/components/ConflictModal';
import { filterRecords } from '@/utils/export';
import type { ConflictItem, RoomAllocation } from '@/types';
import { QUALITY_TYPE_LABELS } from '@/types';

export const AllocationList = () => {
  const allocations = useAllocationStore(state => state.allocations);
  const qualityIssues = useAllocationStore(state => state.qualityIssues);
  const filters = useAllocationStore(state => state.filters);
  const initSampleData = useAllocationStore(state => state.initSampleData);
  const clearAllData = useAllocationStore(state => state.clearAllData);
  const checkQuality = useAllocationStore(state => state.checkQuality);

  const [sourceDrawerRecordId, setSourceDrawerRecordId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);
  const [isSourceDrawerOpen, setIsSourceDrawerOpen] = useState(false);

  const filteredAllocations = useMemo(() => {
    let filtered: RoomAllocation[] = filterRecords(allocations, filters);
    if (filters.qualityFilter) {
      const issueRecordIds = qualityIssues
        .filter(i => i.type === filters.qualityFilter)
        .map(i => i.recordId);
      filtered = filtered.filter(r => issueRecordIds.includes(r.id));
    }
    return filtered;
  }, [allocations, filters, qualityIssues]);

  useEffect(() => {
    if (allocations.length === 0) {
      initSampleData();
    }
  }, [allocations.length, initSampleData]);

  useEffect(() => {
    checkQuality();
  }, [allocations, checkQuality]);

  const handleViewSource = (recordId: string) => {
    setSourceDrawerRecordId(recordId);
    setIsSourceDrawerOpen(true);
  };

  const handleConflictsFound = (newConflicts: ConflictItem[], versionId: string) => {
    setConflicts(newConflicts);
    setPendingVersionId(versionId);
    setIsImportModalOpen(false);
  };

  const handleConflictClose = () => {
    setConflicts([]);
    setPendingVersionId(null);
  };

  const emptyCount = qualityIssues.filter(i => i.type === 'empty').length;
  const duplicateCount = qualityIssues.filter(i => i.type === 'duplicate').length;
  const boundaryCount = qualityIssues.filter(i => i.type === 'boundary').length;

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-900 rounded-lg">
                <Hotel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-serif text-xl font-bold text-gray-800">
                  巡演酒店房型分配
                </h1>
                <p className="text-sm text-gray-500">
                  厂牌运营交接工具
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={initSampleData}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                重新加载样例
              </button>
              <button
                onClick={clearAllData}
                className="btn-danger text-sm flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                清空数据
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {qualityIssues.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="card flex items-start gap-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-warning-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{emptyCount}</div>
                <div className="text-sm text-gray-500">
                  {QUALITY_TYPE_LABELS.empty}待处理
                </div>
              </div>
            </div>
            <div className="card flex items-start gap-3">
              <div className="p-2 bg-error-100 rounded-lg">
                <Copy className="w-5 h-5 text-error-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{duplicateCount}</div>
                <div className="text-sm text-gray-500">
                  {QUALITY_TYPE_LABELS.duplicate}待处理
                </div>
              </div>
            </div>
            <div className="card flex items-start gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <Info className="w-5 h-5 text-info-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{boundaryCount}</div>
                <div className="text-sm text-gray-500">
                  {QUALITY_TYPE_LABELS.boundary}待确认
                </div>
              </div>
            </div>
          </div>
        )}

        <FilterBar onImport={() => setIsImportModalOpen(true)} />

        <DataTable
          records={filteredAllocations}
          onViewSource={handleViewSource}
        />

        <div className="mt-4 text-center text-sm text-gray-400">
          <p>💡 小提示：备注改完会自动保存，刷新页面也不会丢哦</p>
          <p className="mt-1">导出的清单会跟你当前筛选的结果保持一致</p>
        </div>
      </main>

      <SourceDrawer
        recordId={sourceDrawerRecordId || ''}
        isOpen={isSourceDrawerOpen}
        onClose={() => setIsSourceDrawerOpen(false)}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConflictsFound={handleConflictsFound}
      />

      <ConflictModal
        isOpen={conflicts.length > 0 && pendingVersionId !== null}
        conflicts={conflicts}
        versionId={pendingVersionId || ''}
        onClose={handleConflictClose}
      />
    </div>
  );
};
