import { CheckCircle, AlertTriangle, FilePlus2, FileCheck, Eye } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { RecordDetailModal } from '../components/RecordDetailModal';
import type { ScheduleStatus } from '../types';

const statusFilters: { value: ScheduleStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: '全部', color: 'text-gray-600 hover:bg-gray-100' },
  { value: 'normal', label: '正常', color: 'text-success-600 hover:bg-success-50' },
  { value: 'pending_review', label: '待复核', color: 'text-warning-600 hover:bg-warning-50' },
  { value: 'supplemented', label: '补录', color: 'text-supplement-600 hover:bg-supplement-50' },
  { value: 'reviewed', label: '已复核', color: 'text-primary-600 hover:bg-primary-50' },
];

export function Home() {
  const {
    records,
    statusFilter,
    setStatusFilter,
    selectedRecordId,
    setSelectedRecordId,
    getRecordsByStatus,
    getRecordById,
    getHistoryByRecordId,
    getConflictsByRecordId,
  } = useScheduleStore();

  const filteredRecords = getRecordsByStatus(statusFilter);
  const selectedRecord = selectedRecordId ? getRecordById(selectedRecordId) : null;
  const selectedHistory = selectedRecordId ? getHistoryByRecordId(selectedRecordId) : [];
  const selectedConflicts = selectedRecordId ? getConflictsByRecordId(selectedRecordId) : [];

  const stats = {
    normal: records.filter((r) => r.status === 'normal' || r.status === 'reviewed').length,
    pending: records.filter((r) => r.status === 'pending_review').length,
    supplemented: records.filter((r) => r.status === 'supplemented').length,
    conflict: records.filter((r) => r.status === 'conflict').length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">排程总览</h1>
        <p className="text-gray-500">查看夜间采样点补给排程整体情况，包含正常、待复核、补录等状态记录。</p>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        <StatCard
          title="正常记录"
          value={stats.normal}
          color="success"
          icon={<CheckCircle className="w-6 h-6 text-success-600" />}
          subtitle="口径一致，处理顺畅"
        />
        <StatCard
          title="待复核"
          value={stats.pending}
          color="warning"
          icon={<AlertTriangle className="w-6 h-6 text-warning-600" />}
          subtitle="需社区书记复核"
        />
        <StatCard
          title="补录记录"
          value={stats.supplemented}
          color="supplement"
          icon={<FilePlus2 className="w-6 h-6 text-supplement-600" />}
          subtitle="含人工修正和重跑"
        />
        <StatCard
          title="冲突记录"
          value={stats.conflict}
          color="primary"
          icon={<FileCheck className="w-6 h-6 text-primary-600" />}
          subtitle="口径冲突处理中"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">排程记录列表</h2>
            <div className="flex items-center gap-1">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === f.value
                      ? 'bg-gray-900 text-white'
                      : f.color + ' text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">采样点名称</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">投诉编号</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">补给时间</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">标记</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedRecordId(record.id)}
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900">{record.pointName}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-600 font-mono">{record.complaintNo || '-'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-600">{record.supplyTime}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {record.hasManualCorrection && (
                        <span className="text-xs px-2 py-0.5 bg-supplement-100 text-supplement-700 rounded">
                          人工修正
                        </span>
                      )}
                      {record.hasRerun && (
                        <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded">
                          重跑
                        </span>
                      )}
                      {!record.hasManualCorrection && !record.hasRerun && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRecordId(record.id);
                      }}
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-500 text-center">
            共 {filteredRecords.length} 条记录
            {statusFilter !== 'all' && (
              <span> · 筛选条件：{statusFilters.find((f) => f.value === statusFilter)?.label}</span>
            )}
          </p>
        </div>
      </div>

      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          history={selectedHistory}
          conflicts={selectedConflicts}
          onClose={() => setSelectedRecordId(null)}
        />
      )}
    </div>
  );
}
