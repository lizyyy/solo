import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  Filter,
  User,
  Calendar
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import StatusUpdateModal from '../components/StatusUpdateModal';
import { RecordStatus } from '../types';

const PendingCenter: React.FC = () => {
  const navigate = useNavigate();
  const { records, updateRecordStatus } = useStore();
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'abnormal'>('all');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const pendingRecords = records.filter(r => 
    r.currentStatus === 'pending' || r.currentStatus === 'abnormal'
  );

  const filteredRecords = pendingRecords.filter(record => {
    if (filterType === 'all') return true;
    return record.currentStatus === filterType;
  });

  const getLatestReason = (record: typeof records[0]) => {
    const latestVersion = record.versions[record.versions.length - 1];
    return latestVersion?.reason || '无备注';
  };

  const handleStatusUpdate = (id: string) => {
    setSelectedRecordId(id);
    setStatusModalOpen(true);
  };

  const confirmStatusUpdate = (status: RecordStatus, reason: string) => {
    if (selectedRecordId) {
      updateRecordStatus(selectedRecordId, status, reason);
      setSelectedRecordId(null);
    }
  };

  const selectedRecord = selectedRecordId ? records.find(r => r.id === selectedRecordId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            待处理中心
          </h2>
          <p className="text-slate-500 mt-1">
            共 <span className="font-semibold text-rose-600">{pendingRecords.length}</span> 条记录需要处理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'pending' | 'abnormal')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 text-sm bg-white"
          >
            <option value="all">全部待处理</option>
            <option value="pending">待确认</option>
            <option value="abnormal">异常</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-amber-800 text-sm">待确认</p>
              <p className="text-3xl font-bold text-amber-900">
                {records.filter(r => r.currentStatus === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-rose-800 text-sm">异常</p>
              <p className="text-3xl font-bold text-rose-900">
                {records.filter(r => r.currentStatus === 'abnormal').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecords.map((record) => (
          <div 
            key={record.id}
            className={`bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md ${
              record.currentStatus === 'abnormal' ? 'border-rose-200' : 'border-amber-200'
            }`}
          >
            <div className={`h-1 ${
              record.currentStatus === 'abnormal' ? 'bg-rose-500' : 'bg-amber-500'
            }`}></div>
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">{record.name}</h3>
                    <StatusBadge status={record.currentStatus} />
                    <SourceBadge source={record.source} />
                  </div>
                  <p className="text-sm text-slate-500 mb-3 font-mono">{record.materialCode} · {record.location}</p>
                  
                  <div className={`p-4 rounded-lg mb-4 ${
                    record.currentStatus === 'abnormal' ? 'bg-rose-50' : 'bg-amber-50'
                  }`}>
                    <p className={`text-sm font-medium mb-1 ${
                      record.currentStatus === 'abnormal' ? 'text-rose-800' : 'text-amber-800'
                    }`}>
                      {record.currentStatus === 'abnormal' ? '异常原因' : '待处理原因'}
                    </p>
                    <p className={`text-sm ${
                      record.currentStatus === 'abnormal' ? 'text-rose-700' : 'text-amber-700'
                    }`}>
                      {getLatestReason(record)}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{record.updatedBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{record.updatedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleStatusUpdate(record.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      record.currentStatus === 'abnormal'
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    处理
                  </button>
                  <button
                    onClick={() => navigate(`/record/${record.id}`)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredRecords.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-slate-700 font-medium">全部处理完毕</p>
            <p className="text-slate-500 text-sm mt-1">当前没有待处理的记录</p>
          </div>
        )}
      </div>

      <StatusUpdateModal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setSelectedRecordId(null);
        }}
        onConfirm={confirmStatusUpdate}
        currentStatus={selectedRecord?.currentStatus}
        recordName={selectedRecord?.name}
      />
    </div>
  );
};

export default PendingCenter;
