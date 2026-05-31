import { useState, useMemo } from 'react';
import { Search, Filter, Edit, CheckCircle, AlertTriangle, User, Clock } from 'lucide-react';
import { useAppStore } from '@/store';
import type { RecordStatus, RecordSource, BaseRecord } from '@/types';
import { statusLabels, sourceLabels } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import SourceLabel from '@/components/SourceLabel';
import HistoryDrawer from '@/components/HistoryDrawer';
import { formatDate, getStatusColor } from '@/utils/helpers';

export default function RecordsPage() {
  const { records, filters, setFilters, selectRecord, selectedRecordId, updateRecordStatus, currentUser } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');
  const [editStatus, setEditStatus] = useState<RecordStatus>('normal');

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.source && r.source !== filters.source) return false;
      if (filters.modifiedBy && r.modifiedBy !== filters.modifiedBy) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          r.content.carModel?.toLowerCase().includes(search) ||
          r.content.vin?.toLowerCase().includes(search) ||
          r.content.position?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [records, filters]);

  const stats = useMemo(() => {
    const total = records.length;
    const byStatus: Record<RecordStatus, number> = {
      normal: 0, late: 0, duplicate: 0, pending: 0,
    };
    const bySource: Record<RecordSource, number> = {
      model_list: 0, inspection_photo: 0, manual_correction: 0,
    };
    records.forEach(r => {
      byStatus[r.status]++;
      bySource[r.source]++;
    });
    return { total, byStatus, bySource };
  }, [records]);

  const handleEditStatus = (record: BaseRecord) => {
    setEditingId(record.id);
    setEditStatus(record.status);
    setEditReason('');
  };

  const handleSaveStatus = (recordId: string) => {
    if (editReason.trim()) {
      updateRecordStatus(recordId, editStatus, editReason);
      setEditingId(null);
      setEditReason('');
    }
  };

  const closeDrawer = () => selectRecord(null);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">记录总览</h1>
        <p className="text-slate-500">查看所有展车记录，按状态筛选，追踪修改历史</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(['normal', 'late', 'duplicate', 'pending'] as RecordStatus[]).map(status => (
          <div key={status} className="card card-hover p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">{statusLabels[status]}</span>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {stats.byStatus[status]}
            </div>
            <div className="text-xs text-slate-400">
              {stats.total > 0 ? ((stats.byStatus[status] / stats.total) * 100).toFixed(1) : 0}%
            </div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索车型、VIN、位置..."
                  className="input pl-10"
                  value={filters.search || ''}
                  onChange={e => setFilters({ search: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="input w-36 text-sm"
                value={filters.status || ''}
                onChange={e => setFilters({ status: e.target.value as RecordStatus | undefined })}
              >
                <option value="">全部状态</option>
                {(['normal', 'late', 'duplicate', 'pending'] as RecordStatus[]).map(s => (
                  <option key={s} value={s}>{statusLabels[s]}</option>
                ))}
              </select>
              
              <select
                className="input w-36 text-sm"
                value={filters.source || ''}
                onChange={e => setFilters({ source: e.target.value as RecordSource | undefined })}
              >
                <option value="">全部来源</option>
                {(['model_list', 'inspection_photo', 'manual_correction'] as RecordSource[]).map(s => (
                  <option key={s} value={s}>{sourceLabels[s]}</option>
                ))}
              </select>

              <button
                className="btn btn-secondary text-sm"
                onClick={() => setFilters({ status: undefined, source: undefined, search: '' })}
              >
                重置筛选
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto scrollbar-thin">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无符合条件的记录</p>
            </div>
          ) : (
            filteredRecords.map((record, index) => (
              <div
                key={record.id}
                className="p-4 hover:bg-slate-50 transition-colors animate-fade-in-up group"
                style={{ '--stagger-index': index } as React.CSSProperties}
              >
                {editingId === record.id ? (
                  <div className="flex items-center space-x-4 p-3 bg-primary-50 rounded-lg">
                    <select
                      className="input w-32 text-sm"
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value as RecordStatus)}
                    >
                      {(['normal', 'late', 'duplicate', 'pending'] as RecordStatus[]).map(s => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="input flex-1 text-sm"
                      placeholder="请输入修改原因..."
                      value={editReason}
                      onChange={e => setEditReason(e.target.value)}
                    />
                    <button
                      className="btn btn-primary text-sm"
                      onClick={() => handleSaveStatus(record.id)}
                      disabled={!editReason.trim()}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      确认
                    </button>
                    <button
                      className="btn btn-secondary text-sm"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start space-x-4">
                    <div className={`w-1.5 h-16 rounded-full transition-all ${getStatusColor(record.status)}`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-semibold text-slate-800 text-base">
                          {record.content.carModel || '未命名记录'}
                        </h4>
                        <StatusBadge status={record.status} />
                        <SourceLabel source={record.source} />
                        {record.content.modelNumber && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {record.content.modelNumber}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                        {record.content.vin && (
                          <div>
                            <span className="text-slate-400">VIN：</span>
                            <span className="font-mono text-slate-700">{record.content.vin.slice(-10)}</span>
                          </div>
                        )}
                        {record.content.color && (
                          <div>
                            <span className="text-slate-400">颜色：</span>
                            <span className="text-slate-700">{record.content.color}</span>
                          </div>
                        )}
                        {record.content.position && (
                          <div>
                            <span className="text-slate-400">展位：</span>
                            <span className="text-slate-700">{record.content.position}</span>
                          </div>
                        )}
                        {record.attachments.length > 0 && (
                          <div>
                            <span className="text-slate-400">附件：</span>
                            <span className="text-slate-700">{record.attachments.length} 个</span>
                          </div>
                        )}
                      </div>

                      {record.pendingReason && (
                        <div className="flex items-start space-x-2 text-sm text-yellow-700 bg-yellow-50 rounded p-2 mb-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{record.pendingReason}</span>
                        </div>
                      )}

                      {record.content.notes && (
                        <p className="text-sm text-slate-500 italic">
                          备注：{record.content.notes}
                        </p>
                      )}

                      <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {record.modifiedBy}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(record.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        onClick={() => handleEditStatus(record)}
                        title="修改状态"
                      >
                        <Edit className="w-4 h-4 text-slate-500" />
                      </button>
                      <button
                        className="p-2 hover:bg-primary-100 rounded-lg transition-colors"
                        onClick={() => selectRecord(record.id)}
                        title="查看详情和历史"
                      >
                        <Clock className="w-4 h-4 text-primary-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedRecordId && (
        <HistoryDrawer recordId={selectedRecordId} onClose={closeDrawer} />
      )}
    </div>
  );
}
