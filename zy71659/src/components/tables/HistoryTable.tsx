import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { HistoryRecord } from '@/types/history';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTimestamp } from '@/utils/formatters';
import { ENTITY_TYPE_LABELS } from '@/types/history';
import { Modal } from '@/components/common/Modal';

interface HistoryTableProps {
  history: HistoryRecord[];
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ history }) => {
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  const viewDetail = (record: HistoryRecord) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);
  };

  const renderJsonDiff = (before: unknown, after: unknown) => {
    const formatJson = (obj: unknown) => {
      if (obj === null || obj === undefined) return '-';
      return JSON.stringify(obj, null, 2);
    };

    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-slate-400 mb-1">变更前</div>
          <pre className="bg-slate-900 p-3 rounded-sm text-xs font-mono text-slate-300 overflow-auto max-h-60 scrollbar-thin">
            {formatJson(before)}
          </pre>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">变更后</div>
          <pre className="bg-slate-900 p-3 rounded-sm text-xs font-mono text-emerald-400 overflow-auto max-h-60 scrollbar-thin">
            {formatJson(after)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="text-sm font-medium text-slate-200">操作历史记录</span>
          <span className="text-xs text-slate-500">共 {history.length} 条记录</span>
        </div>
        <div className="overflow-x-auto max-h-96 scrollbar-thin">
          <table className="w-full">
            <thead className="table-header sticky top-0">
              <tr>
                <th className="table-cell text-left">时间</th>
                <th className="table-cell text-left">操作人</th>
                <th className="table-cell text-left">操作类型</th>
                <th className="table-cell text-left">实体类型</th>
                <th className="table-cell text-left">实体ID</th>
                <th className="table-cell text-left">备注</th>
                <th className="table-cell text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr
                  key={record.id}
                  className="transition-colors hover:bg-slate-700/30"
                >
                  <td className="table-cell font-mono text-xs text-slate-300">
                    {formatTimestamp(record.timestamp)}
                  </td>
                  <td className="table-cell text-xs text-slate-300">
                    {record.operator}
                  </td>
                  <td className="table-cell">
                    <StatusBadge type="action" value={record.action} />
                  </td>
                  <td className="table-cell text-xs text-slate-400">
                    {ENTITY_TYPE_LABELS[record.entityType]}
                  </td>
                  <td className="table-cell font-mono text-xs text-slate-500">
                    {record.entityId.slice(-8)}
                  </td>
                  <td className="table-cell text-xs text-slate-400 max-w-xs truncate">
                    {record.comment || '-'}
                  </td>
                  <td className="table-cell text-right">
                    <button
                      className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                      onClick={() => viewDetail(record)}
                      title="查看详情"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="操作历史详情"
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">操作时间</div>
                <div className="text-sm text-slate-200 font-mono">
                  {formatTimestamp(selectedRecord.timestamp)}
                </div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">操作人</div>
                <div className="text-sm text-slate-200">{selectedRecord.operator}</div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">操作类型</div>
                <StatusBadge type="action" value={selectedRecord.action} />
              </div>
              <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">实体类型</div>
                <div className="text-sm text-slate-200">
                  {ENTITY_TYPE_LABELS[selectedRecord.entityType]}
                </div>
              </div>
            </div>

            {selectedRecord.comment && (
              <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">备注</div>
                <div className="text-sm text-slate-200">{selectedRecord.comment}</div>
              </div>
            )}

            <div>
              <div className="text-xs text-slate-400 mb-2">状态变更对比</div>
              {renderJsonDiff(selectedRecord.beforeState, selectedRecord.afterState)}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
