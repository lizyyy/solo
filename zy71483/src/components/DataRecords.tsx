import { useState } from 'react';
import {
  Filter,
  Plus,
  Undo2,
  FilePlus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  getStatusName,
  getQualityName,
  getAnomalyTypeName,
} from '../utils/anomalyDetector';
import type { RecordStatus, DataQuality } from '../types';

export function DataRecords() {
  const {
    filteredRecords,
    filters,
    setFilters,
    addRecord,
    withdrawRecord,
    supplementRecord,
    batches,
    currentBatchId,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'anomaly'>('all');
  const [remarks, setRemarks] = useState('');

  const displayRecords = filteredRecords.filter((r) => {
    if (activeTab === 'pending') return r.quality === 'pending';
    if (activeTab === 'anomaly') return r.quality === 'anomaly';
    return true;
  });

  const handleStatusFilterChange = (status: RecordStatus, checked: boolean) => {
    const newStatuses = checked
      ? [...filters.status, status]
      : filters.status.filter((s) => s !== status);
    setFilters({ status: newStatuses });
  };

  const handleQualityFilterChange = (quality: DataQuality, checked: boolean) => {
    const newQualities = checked
      ? [...filters.quality, quality]
      : filters.quality.filter((q) => q !== quality);
    setFilters({ quality: newQualities });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'normal':
        return 'badge-normal';
      case 'supplement':
        return 'badge-supplement';
      case 'withdrawn':
        return 'badge bg-neutral-100 text-neutral-500';
      case 'duplicate':
        return 'badge bg-warning-100 text-warning-700';
      default:
        return 'badge-normal';
    }
  };

  const getQualityBadgeClass = (quality: string) => {
    switch (quality) {
      case 'normal':
        return 'badge-normal';
      case 'pending':
        return 'badge-pending';
      case 'anomaly':
        return 'badge-anomaly';
      default:
        return 'badge-normal';
    }
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-500" />
          数据明细
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => addRecord('normal', remarks)}
            className="btn-success text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            提交记录
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <span className="text-sm text-neutral-500">筛选:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['normal', 'supplement', 'withdrawn', 'duplicate'] as RecordStatus[]).map(
              (status) => (
                <label
                  key={status}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.status.includes(status)}
                    onChange={(e) =>
                      handleStatusFilterChange(status, e.target.checked)
                    }
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-neutral-600">
                    {getStatusName(status)}
                  </span>
                </label>
              )
            )}
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            全部 ({filteredRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              activeTab === 'pending'
                ? 'bg-warning-500 text-white'
                : 'bg-warning-50 text-warning-600 hover:bg-warning-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            待确认 (
            {filteredRecords.filter((r) => r.quality === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('anomaly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              activeTab === 'anomaly'
                ? 'bg-danger-500 text-white'
                : 'bg-danger-50 text-danger-600 hover:bg-danger-100'
            }`}
          >
            <XCircle className="w-4 h-4" />
            异常 (
            {filteredRecords.filter((r) => r.quality === 'anomaly').length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="添加备注..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="form-input flex-1"
          />
          <select
            value={filters.batchId}
            onChange={(e) => setFilters({ batchId: e.target.value })}
            className="form-select w-48"
          >
            <option value="">全部批次</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th className="table-header">时间</th>
              <th className="table-header">状态</th>
              <th className="table-header">质量</th>
              <th className="table-header">总功率</th>
              <th className="table-header">损失</th>
              <th className="table-header">异常标记</th>
              <th className="table-header">备注</th>
              <th className="table-header">操作</th>
            </tr>
          </thead>
          <tbody>
            {displayRecords.map((record) => (
              <tr
                key={record.id}
                className={
                  record.quality === 'anomaly' ? 'table-row-anomaly' : 'table-row'
                }
              >
                <td className="table-cell">
                  {new Date(record.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="table-cell">
                  <span className={getStatusBadgeClass(record.status)}>
                    {getStatusName(record.status)}
                  </span>
                </td>
                <td className="table-cell">
                  <span className={getQualityBadgeClass(record.quality)}>
                    {getQualityName(record.quality)}
                  </span>
                </td>
                <td className="table-cell font-mono text-solar-600">
                  {record.totalPower.toFixed(1)} W
                </td>
                <td className="table-cell font-mono text-danger-500">
                  {record.totalLoss.toFixed(1)} W
                </td>
                <td className="table-cell">
                  {record.anomalyFlags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {record.anomalyFlags.map((flag) => (
                        <span
                          key={flag}
                          className="text-xs px-1.5 py-0.5 bg-danger-100 text-danger-700 rounded"
                        >
                          {getAnomalyTypeName(flag as any)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <CheckCircle className="w-4 h-4 text-solar-500" />
                  )}
                </td>
                <td className="table-cell max-w-32 truncate">
                  {record.remarks || '-'}
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1">
                    {record.status !== 'withdrawn' && (
                      <>
                        <button
                          onClick={() => supplementRecord(record.id)}
                          className="p-1.5 text-primary-500 hover:bg-primary-50 rounded"
                          title="补录"
                        >
                          <FilePlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => withdrawRecord(record.id)}
                          className="p-1.5 text-neutral-400 hover:bg-neutral-100 rounded"
                          title="撤回"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {displayRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="table-cell text-center text-neutral-400 py-8">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
