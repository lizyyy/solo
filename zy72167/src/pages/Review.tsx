import { useState } from 'react';
import { useCarbonStore } from '@/store/carbonStore';
import type { RecordStatus, CarbonRecord } from '@/types';
import {
  CheckSquare,
  Check,
  X,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import SourceBadge from '@/components/common/SourceBadge';
import StatusBadge from '@/components/common/StatusBadge';

interface Column {
  status: RecordStatus | 'review_confirmed';
  label: string;
  icon: typeof Clock;
  color: string;
  bgColor: string;
}

const columns: Column[] = [
  {
    status: 'auto_merged',
    label: '待审核（自动归并）',
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    status: 'needs_confirmation',
    label: '需人工确认',
    icon: AlertTriangle,
    color: 'text-warn-600',
    bgColor: 'bg-warn-50',
  },
  {
    status: 'review_confirmed',
    label: '已审核通过',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
];

export default function Review() {
  const { records, updateRecordStatus, confirmGroup, mergeGroups, addRemark } = useCarbonStore();
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [remarkModal, setRemarkModal] = useState<{ record: CarbonRecord; text: string } | null>(null);

  const getRecordsForColumn = (status: RecordStatus | 'review_confirmed') => {
    return records.filter(r => {
      if (status === 'review_confirmed') {
        return r.status === 'review_confirmed';
      }
      return r.status === status;
    });
  };

  const toggleExpand = (recordId: string) => {
    setExpandedRecord(expandedRecord === recordId ? null : recordId);
  };

  const handleConfirm = (record: CarbonRecord) => {
    const group = mergeGroups.find(g => g.mergedRecordIds.includes(record.id));
    if (group && group.status !== 'confirmed') {
      confirmGroup(group.id);
    } else {
      updateRecordStatus(
        record.id,
        'review_confirmed',
        `人工审核通过，点位信息确认无误`
      );
    }
  };

  const handleReject = (record: CarbonRecord) => {
    const reason = prompt('请输入驳回原因：');
    if (reason) {
      updateRecordStatus(record.id, 'rejected', reason);
    }
  };

  const handleAddRemark = (record: CarbonRecord) => {
    setRemarkModal({ record, text: '' });
  };

  const saveRemark = () => {
    if (remarkModal && remarkModal.text.trim()) {
      addRemark(remarkModal.record.id, remarkModal.text);
      setRemarkModal(null);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  const actionTypeLabels: Record<string, string> = {
    import: '数据导入',
    merge: '自动归并',
    confirm: '人工确认',
    reject: '驳回',
    split: '拆分',
    supplement: '补录',
    remark: '添加备注',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif text-lg font-semibold text-gray-800 mb-1">人工复核工作台</h3>
        <p className="text-sm text-gray-500">
          三栏式审核流程，支持逐条审核或批量操作，所有操作均留痕可追溯
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {columns.map((column) => {
          const columnRecords = getRecordsForColumn(column.status);
          const Icon = column.icon;
          
          return (
            <div key={column.status} className="flex flex-col">
              <div className={`${column.bgColor} rounded-t-md p-4 border border-b-0 border-gray-200`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${column.color}`} />
                    <span className="font-medium text-gray-800">{column.label}</span>
                  </div>
                  <span className={`${column.color} font-bold text-lg`}>
                    {columnRecords.length}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 bg-gray-50 border border-t-0 border-gray-200 rounded-b-md p-3 space-y-3 min-h-[600px] overflow-y-auto">
                {columnRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <CheckSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无待处理记录</p>
                  </div>
                ) : (
                  columnRecords.map((record, idx) => {
                    const isExpanded = expandedRecord === record.id;
                    const group = mergeGroups.find(g => g.mergedRecordIds.includes(record.id));
                    
                    return (
                      <div
                        key={record.id}
                        className="card animate-scale-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => toggleExpand(record.id)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <h5 className="font-medium text-gray-800 flex-1 pr-2">
                              {record.pointName}
                            </h5>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                            {record.address}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <SourceBadge sourceType={record.sourceType} className="text-xs" />
                              <span className="text-sm font-semibold text-primary-600">
                                {record.carbonAmount}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">{record.recordDate}</span>
                          </div>
                          
                          {record.isOldCaliber && (
                            <div className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
                              ⚠️ 旧口径数据：{record.oldCaliberNote}
                            </div>
                          )}
                          
                          {group && group.status === 'needs_review' && (
                            <div className="mt-2 text-xs text-warn-600 bg-warn-50 rounded px-2 py-1">
                              ⚠️ 匹配度 {group.confidenceScore}%，需人工确认是否为同一点位
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 space-y-4">
                            {column.status !== 'review_confirmed' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleConfirm(record); }}
                                  className="flex-1 btn-primary text-sm py-1.5 flex items-center justify-center gap-1"
                                >
                                  <Check className="w-4 h-4" />
                                  确认通过
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReject(record); }}
                                  className="flex-1 btn-danger text-sm py-1.5 flex items-center justify-center gap-1"
                                >
                                  <X className="w-4 h-4" />
                                  驳回
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAddRemark(record); }}
                                  className="btn-secondary text-sm py-1.5 px-3"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            <div className="space-y-2">
                              <h6 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                审核痕迹
                              </h6>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {record.auditTrail.map((trail, idx) => (
                                  <div key={idx} className="text-xs bg-gray-50 rounded p-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium text-gray-700">
                                        {actionTypeLabels[trail.actionType] || trail.actionType}
                                      </span>
                                      <span className="text-gray-400">{formatTime(trail.timestamp)}</span>
                                    </div>
                                    <p className="text-gray-600">{trail.actionReason}</p>
                                    {trail.remark && (
                                      <p className="text-primary-600 mt-1">备注：{trail.remark}</p>
                                    )}
                                    <p className="text-gray-400 mt-1">操作人：{trail.operator}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {record.remark && (
                              <div className="bg-primary-50 rounded p-3">
                                <h6 className="text-xs font-medium text-primary-700 mb-1">人工备注</h6>
                                <p className="text-sm text-primary-800">{record.remark}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {remarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md animate-scale-in">
            <h3 className="font-serif text-lg font-semibold text-gray-800 mb-2">添加备注</h3>
            <p className="text-sm text-gray-600 mb-4">{remarkModal.record.pointName}</p>
            <textarea
              value={remarkModal.text}
              onChange={(e) => setRemarkModal({ ...remarkModal, text: e.target.value })}
              placeholder="请输入备注内容..."
              className="input-field h-24 resize-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRemarkModal(null)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={saveRemark}
                disabled={!remarkModal.text.trim()}
                className="btn-primary disabled:opacity-50"
              >
                保存备注
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
