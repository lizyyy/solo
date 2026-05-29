import { useState, useEffect } from 'react';
import { useRecordStore } from '@/store/useRecordStore';
import { StatsCards } from '@/components/StatsCards';
import { FilterPanel } from '@/components/FilterPanel';
import { RecordTable } from '@/components/RecordTable';
import { RecordForm } from '@/components/RecordForm';
import { RecordDetail } from '@/components/RecordDetail';
import {
  Plus,
  Download,
  Disc,
  AlertTriangle,
  List,
} from 'lucide-react';
import type { InventoryRecord } from '@/types';
import { downloadCSV, filterRecordsForExport } from '@/utils/csvExport';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InventoryRecord | undefined>();
  const [viewingRecord, setViewingRecord] = useState<InventoryRecord | undefined>();
  const [exportSuccess, setExportSuccess] = useState(false);

  const filteredRecords = useRecordStore((s) => s.getFilteredRecords());
  const unresolvedExceptions = useRecordStore((s) =>
    s.getUnresolvedExceptions()
  );

  useEffect(() => {
    useRecordStore.getState().loadFromStorage();
  }, []);

  const handleEdit = (record: InventoryRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleView = (record: InventoryRecord) => {
    setViewingRecord(record);
  };

  const handleViewRecordById = (recordId: string) => {
    const record = useRecordStore.getState().getRecordById(recordId);
    if (record) {
      setViewingRecord(record);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRecord(undefined);
  };

  const handleExport = () => {
    const exportable = filterRecordsForExport(filteredRecords);
    if (exportable.length === 0) {
      alert('没有可导出的记录（仅"已核对"状态的记录可导出）');
      return;
    }
    downloadCSV(exportable);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="bg-vinyl-700 text-white shadow-vinyl-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Disc className="w-8 h-8 text-caramel-400" />
              <div>
                <h1 className="font-display text-xl font-bold">黑胶库存版号核对</h1>
                <p className="text-white/70 text-xs">唱片店库存管理系统</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="relative bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm text-sm flex items-center gap-2 transition-colors"
                onClick={() => navigate('/exceptions')}
              >
                <AlertTriangle className="w-4 h-4" />
                异常清单
                {unresolvedExceptions.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-alert-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {unresolvedExceptions.length}
                  </span>
                )}
              </button>
              <button
                className="bg-caramel-400 hover:bg-caramel-300 text-vinyl-900 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors shadow-vinyl hover:shadow-vinyl-lg hover:-translate-y-px"
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
                {exportSuccess ? '已导出!' : '导出上架'}
              </button>
              <button
                className="bg-white text-vinyl-700 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors shadow-vinyl hover:shadow-vinyl-lg hover:-translate-y-px"
                onClick={() => {
                  setEditingRecord(undefined);
                  setShowForm(true);
                }}
              >
                <Plus className="w-4 h-4" />
                录入唱片
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <StatsCards />
        <FilterPanel />

        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-vinyl-600">
            共 <span className="font-semibold">{filteredRecords.length}</span> 条记录
            {useRecordStore.getState().filters.searchText && (
              <span className="ml-1">（已筛选）</span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="text-xs text-vinyl-500 bg-vinyl-700/10 px-2 py-1 rounded-sm">
              仅"已核对"状态可导出
            </span>
          </div>
        </div>

        <RecordTable onEdit={handleEdit} onView={handleView} />
      </main>

      {showForm && (
        <RecordForm
          record={editingRecord}
          onClose={handleCloseForm}
          onSuccess={() => {
            setEditingRecord(undefined);
          }}
        />
      )}

      {viewingRecord && (
        <RecordDetail
          record={viewingRecord}
          onClose={() => setViewingRecord(undefined)}
          onEdit={(r) => {
            setViewingRecord(undefined);
            handleEdit(r);
          }}
        />
      )}
    </div>
  );
}
