import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { RecordStatus } from '@/types';
import { StatusFilter } from '@/components/RecordList/StatusFilter';
import { RecordTable } from '@/components/RecordList/RecordTable';
import { BatchActions } from '@/components/RecordList/BatchActions';
import { FileImport } from '@/components/common/FileImport';
import { exportToExcel } from '@/utils/importExport';

export function RecordsPage() {
  const records = useRecordStore((state) => state.records);
  const resetToMockData = useRecordStore((state) => state.resetToMockData);
  
  const [selectedStatus, setSelectedStatus] = useState<RecordStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showImport, setShowImport] = useState(false);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
      const matchesSearch =
        searchQuery === '' ||
        record.buildingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.source.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [records, selectedStatus, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: records.length,
      pending: records.filter((r) => r.status === 'pending').length,
      confirmed: records.filter((r) => r.status === 'confirmed').length,
      to_supplement: records.filter((r) => r.status === 'to_supplement').length,
      modified: records.filter((r) => r.status === 'modified').length,
    };
  }, [records]);

  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0];
    exportToExcel(records, `日照推演全部记录_${date}.xlsx`);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">记录管理</h1>
        <p className="text-slate-500">管理和复核所有建筑日照推演记录</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <StatusFilter
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            counts={counts}
          />
          <BatchActions
            onImport={() => setShowImport(true)}
            onExport={handleExport}
            onReset={resetToMockData}
          />
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索建筑名称、房间号、来源..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {showImport ? (
          <FileImport onClose={() => setShowImport(false)} />
        ) : (
          <RecordTable records={filteredRecords} />
        )}

        <div className="text-center text-sm text-slate-400">
          显示 {filteredRecords.length} 条记录，共 {records.length} 条
        </div>
      </div>
    </div>
  );
}
