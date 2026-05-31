import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  History,
  CheckSquare
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import StatusUpdateModal from '../components/StatusUpdateModal';
import { RecordStatus } from '../types';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { 
    records, 
    selectedRecords, 
    toggleRecordSelection, 
    clearSelection,
    updateRecordStatus,
    batchUpdateStatus,
    getStatistics 
  } = useStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedRecordForUpdate, setSelectedRecordForUpdate] = useState<string | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const stats = getStatistics();

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const matchesSearch = 
        record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || record.currentStatus === statusFilter;
      const matchesSource = sourceFilter === 'all' || record.source === sourceFilter;
      
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [records, searchTerm, statusFilter, sourceFilter]);

  const handleRowClick = (id: string) => {
    navigate(`/record/${id}`);
  };

  const handleStatusUpdate = (id: string) => {
    setSelectedRecordForUpdate(id);
    setStatusModalOpen(true);
  };

  const confirmStatusUpdate = (status: RecordStatus, reason: string) => {
    if (selectedRecordForUpdate) {
      updateRecordStatus(selectedRecordForUpdate, status, reason);
      setSelectedRecordForUpdate(null);
    }
  };

  const confirmBatchUpdate = (status: RecordStatus, reason: string) => {
    batchUpdateStatus(selectedRecords, status, reason);
    clearSelection();
  };

  const selectAll = () => {
    if (selectedRecords.length === filteredRecords.length) {
      clearSelection();
    } else {
      useStore.getState().setSelectedRecords(filteredRecords.map(r => r.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            巡检记录
          </h2>
          <p className="text-slate-500 mt-1">查看和管理所有装置灯光巡检记录</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">正常</p>
              <p className="text-3xl font-bold mt-1">{stats.normal}</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-emerald-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">待处理</p>
              <p className="text-3xl font-bold mt-1">{stats.pending}</p>
            </div>
            <Clock className="w-10 h-10 text-amber-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-100 text-sm">异常</p>
              <p className="text-3xl font-bold mt-1">{stats.abnormal}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-rose-200" />
          </div>
        </div>
      </div>

      {selectedRecords.length > 0 && (
        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5" />
            <span>已选择 <strong>{selectedRecords.length}</strong> 条记录</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setBatchModalOpen(true)}
              className="px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
            >
              批量更新状态
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索作品名称、编号、位置..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RecordStatus | 'all')}
              className="px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 text-sm bg-white"
            >
              <option value="all">全部状态</option>
              <option value="normal">正常</option>
              <option value="pending">待处理</option>
              <option value="abnormal">异常</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 text-sm bg-white"
            >
              <option value="all">全部来源</option>
              <option value="first_entry">首次录入</option>
              <option value="re_entry">二次进场</option>
              <option value="manual">人工创建</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRecords.length === filteredRecords.length && filteredRecords.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  材料编号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  作品名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  位置
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  来源
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  版本
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <tr 
                  key={record.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRecords.includes(record.id)}
                      onChange={() => toggleRecordSelection(record.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-mono text-slate-600">{record.materialCode}</span>
                  </td>
                  <td className="px-4 py-4" onClick={() => handleRowClick(record.id)}>
                    <span className="text-sm font-medium text-slate-900">{record.name}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-600">{record.location}</span>
                  </td>
                  <td className="px-4 py-4">
                    <SourceBadge source={record.source} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={record.currentStatus} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <History className="w-4 h-4" />
                      <span>v{record.versions.length}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-500">{record.updatedAt}</span>
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStatusUpdate(record.id)}
                        className="px-3 py-1.5 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
                      >
                        更新状态
                      </button>
                      <button
                        onClick={() => handleRowClick(record.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="p-12 text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">没有找到匹配的记录</p>
          </div>
        )}
      </div>

      <StatusUpdateModal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setSelectedRecordForUpdate(null);
        }}
        onConfirm={confirmStatusUpdate}
        currentStatus={selectedRecordForUpdate ? records.find(r => r.id === selectedRecordForUpdate)?.currentStatus : undefined}
        recordName={records.find(r => r.id === selectedRecordForUpdate)?.name}
      />

      <StatusUpdateModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        onConfirm={confirmBatchUpdate}
        isBatch={true}
        selectedCount={selectedRecords.length}
      />
    </div>
  );
};

export default Home;
