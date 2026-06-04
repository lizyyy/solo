import React, { useMemo, useState } from 'react';
import { AlertOctagon, CheckCircle, Wrench, XCircle, Filter, Search, AlertTriangle } from 'lucide-react';
import { useCleaningStore } from '@/store/useCleaningStore';
import { ThresholdAlertCard } from '@/components/reviews/ThresholdAlertCard';
import type { ReviewStatus } from '@/types';

const ThresholdReview: React.FC = () => {
  const { thresholdAlerts, records } = useCleaningStore();
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlerts = useMemo(() => {
    return thresholdAlerts.filter((alert) => {
      const record = records.find((r) => r.id === alert.recordId);
      const matchesSearch = record
        ? record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          record.materialName.toLowerCase().includes(searchQuery.toLowerCase())
        : false;
      const matchesStatus = statusFilter === 'all' || alert.reviewStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [thresholdAlerts, records, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = thresholdAlerts.length;
    const pending = thresholdAlerts.filter((a) => a.reviewStatus === 'pending_review').length;
    const confirmed = thresholdAlerts.filter((a) => a.reviewStatus === 'confirmed').length;
    const recalibration = thresholdAlerts.filter((a) => a.reviewStatus === 'needs_recalibration').length;
    const rejected = thresholdAlerts.filter((a) => a.reviewStatus === 'rejected').length;
    return { total, pending, confirmed, recalibration, rejected };
  }, [thresholdAlerts]);

  const statusOptions: { value: ReviewStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending_review', label: '待复核' },
    { value: 'confirmed', label: '确认正常' },
    { value: 'needs_recalibration', label: '需要校准' },
    { value: 'rejected', label: '数据作废' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">超阈值复核</h1>
        <p className="text-neutral-500 mt-1">超阈值记录使用平均值覆盖后，留给维修师傅复核确认，不自动归为正常</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon className="w-5 h-5 text-neutral-500" />
            <span className="text-sm text-neutral-600">总计告警</span>
          </div>
          <div className="font-mono text-3xl font-bold text-neutral-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-warning-200 rounded-xl p-4 bg-warning-50/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-warning-500" />
            <span className="text-sm text-warning-700">待复核</span>
          </div>
          <div className="font-mono text-3xl font-bold text-warning-700">{stats.pending}</div>
        </div>
        <div className="bg-white border border-success-200 rounded-xl p-4 bg-success-50/50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-success-500" />
            <span className="text-sm text-success-700">确认正常</span>
          </div>
          <div className="font-mono text-3xl font-bold text-success-700">{stats.confirmed}</div>
        </div>
        <div className="bg-white border border-primary-200 rounded-xl p-4 bg-primary-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-5 h-5 text-primary-500" />
            <span className="text-sm text-primary-700">需要校准</span>
          </div>
          <div className="font-mono text-3xl font-bold text-primary-700">{stats.recalibration}</div>
        </div>
        <div className="bg-white border border-danger-200 rounded-xl p-4 bg-danger-50/50">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-danger-500" />
            <span className="text-sm text-danger-700">数据作废</span>
          </div>
          <div className="font-mono text-3xl font-bold text-danger-700">{stats.rejected}</div>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Wrench className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-primary-800 mb-1">复核规则</div>
            <ul className="text-sm text-primary-700 space-y-1">
              <li>• <strong>不归为正常</strong>：超阈值记录被平均值覆盖后，状态保持"待复核"，不自动标记为正常</li>
              <li>• <strong>确认正常</strong>：维修师傅检查后确认设备正常，数据可使用</li>
              <li>• <strong>需要校准</strong>：设备需要校准，数据暂时保留但标记为不可靠</li>
              <li>• <strong>数据作废</strong>：设备异常严重，该条数据作废，不可使用</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索记录ID、材料名称..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-neutral-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | 'all')}
            className="px-3 py-2.5 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredAlerts.length > 0 ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const record = records.find((r) => r.id === alert.recordId);
            return (
              <ThresholdAlertCard
                key={alert.id}
                alert={alert}
                record={record ? { id: record.id, materialName: record.materialName } : undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl">
          <CheckCircle className="w-16 h-16 text-success-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">暂无超阈值告警</h3>
          <p className="text-neutral-500">所有数据均在正常范围内</p>
        </div>
      )}
    </div>
  );
};

export default ThresholdReview;
