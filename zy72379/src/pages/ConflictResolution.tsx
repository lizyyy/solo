import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Filter, Search } from 'lucide-react';
import { useCleaningStore } from '@/store/useCleaningStore';
import { ConflictCard } from '@/components/conflicts/ConflictCard';
import type { ConflictResolutionStatus } from '@/types';

const ConflictResolution: React.FC = () => {
  const { conflicts, records } = useCleaningStore();
  const [statusFilter, setStatusFilter] = useState<ConflictResolutionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConflicts = useMemo(() => {
    return conflicts.filter((conflict) => {
      const record = records.find((r) => r.id === conflict.recordId);
      const matchesSearch = record
        ? record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          record.materialName.toLowerCase().includes(searchQuery.toLowerCase())
        : false;
      const matchesStatus = statusFilter === 'all' || conflict.resolutionStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [conflicts, records, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = conflicts.length;
    const pending = conflicts.filter((c) => c.resolutionStatus === 'pending').length;
    const resolved = conflicts.filter((c) => c.resolutionStatus !== 'pending').length;
    return { total, pending, resolved };
  }, [conflicts]);

  const statusOptions: { value: ConflictResolutionStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待裁决' },
    { value: 'accept_photo', label: '已采信照片' },
    { value: 'accept_note', label: '已采信备注' },
    { value: 'rejected', label: '已驳回' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">证据冲突裁决</h1>
        <p className="text-neutral-500 mt-1">当工况照片与手写巡检备注存在冲突时，由林老师进行裁决</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-neutral-500" />
            <span className="text-sm text-neutral-600">总计冲突</span>
          </div>
          <div className="font-mono text-3xl font-bold text-neutral-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-warning-200 rounded-xl p-4 bg-warning-50/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-warning-500" />
            <span className="text-sm text-warning-700">待裁决</span>
          </div>
          <div className="font-mono text-3xl font-bold text-warning-700">{stats.pending}</div>
        </div>
        <div className="bg-white border border-success-200 rounded-xl p-4 bg-success-50/50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-success-500" />
            <span className="text-sm text-success-700">已裁决</span>
          </div>
          <div className="font-mono text-3xl font-bold text-success-700">{stats.resolved}</div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800 mb-1">裁决规则</div>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• <strong>不自动拍板</strong>：系统仅检测冲突并列出证据，最终裁决由实验老师林老师确认</li>
              <li>• <strong>采信照片</strong>：以工况照片的主流程数据为准，忽略手写备注</li>
              <li>• <strong>采信备注</strong>：以手写巡检备注的现场说法为准，覆盖照片数据</li>
              <li>• <strong>驳回待重审</strong>：证据不足，需要重新采集照片或补充备注</li>
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
            onChange={(e) => setStatusFilter(e.target.value as ConflictResolutionStatus | 'all')}
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

      {filteredConflicts.length > 0 ? (
        <div className="space-y-4">
          {filteredConflicts.map((conflict) => {
            const record = records.find((r) => r.id === conflict.recordId);
            return (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                record={record ? { id: record.id, materialName: record.materialName } : undefined}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl">
          <CheckCircle className="w-16 h-16 text-success-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">暂无冲突</h3>
          <p className="text-neutral-500">所有证据均已对齐，无需裁决</p>
        </div>
      )}
    </div>
  );
};

export default ConflictResolution;
