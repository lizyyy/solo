import React, { useState, useEffect } from 'react';
import type { GuaranteeRecord, OperationLog } from '../types';
import { getStatusLabel, getSourceLabel, STATUS_COLORS } from '../types';
import { api } from '../api';

interface RecordDetailProps {
  record: GuaranteeRecord | null;
  onClose: () => void;
  onRefresh: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function parseChanges(changesStr: string): any {
  try {
    return JSON.parse(changesStr);
  } catch {
    return {};
  }
}

export const RecordDetail: React.FC<RecordDetailProps> = ({ record, onClose, onRefresh }) => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(true);
  const [operator, setOperator] = useState('当前用户');

  useEffect(() => {
    if (record) {
      loadLogs();
    }
  }, [record?.id]);

  const loadLogs = async () => {
    if (!record) return;
    try {
      const data = await api.getRecordLogs(record.id);
      setLogs(data);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAction = async () => {
    if (!record || !actionType) return;
    
    if ((actionType === 'withdraw' || actionType === 'reject') && !reason.trim()) {
      alert('请填写原因');
      return;
    }

    if (actionType === 'resolve-dispute' && !reason.trim()) {
      alert('请填写复核原因');
      return;
    }

    setLoading(true);
    try {
      switch (actionType) {
        case 'approve':
          await api.approveRecord(record.id, operator, reason || undefined);
          break;
        case 'reject':
          await api.rejectRecord(record.id, operator, reason);
          break;
        case 'withdraw':
          await api.withdrawRecord(record.id, operator, reason);
          break;
        case 'resolve-dispute':
          await api.resolveDispute(
            record.id,
            operator,
            isDuplicate,
            isDuplicate ? record.duplicateWith : undefined,
            reason
          );
          break;
      }
      
      setActionType(null);
      setReason('');
      onRefresh();
      loadLogs();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!record) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto scrollbar-thin shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            记录详情 #{record.id}
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-2xl"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[record.status]}`}>
              {getStatusLabel(record.status)}
            </span>
            <span className="text-sm text-gray-500">
              版本 v{record.version}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">保证函编号</label>
              <div className="text-sm font-mono font-medium text-gray-900">{record.guaranteeNo}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">客户名称</label>
              <div className="text-sm text-gray-900">{record.customerName}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">金额</label>
              <div className="text-sm font-mono text-gray-900">{record.currency} {record.amount.toLocaleString()}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">来源</label>
              <div className="text-sm text-gray-900">
                {getSourceLabel(record.source)}
                {record.sourceRef && <span className="text-gray-500"> ({record.sourceRef})</span>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">创建人</label>
              <div className="text-sm text-gray-900">{record.createdBy}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">当前处理人</label>
              <div className="text-sm text-gray-900">{record.currentOperator}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">创建时间</label>
              <div className="text-sm text-gray-900">{formatDate(record.createdAt)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">更新时间</label>
              <div className="text-sm text-gray-900">{formatDate(record.updatedAt)}</div>
            </div>
          </div>

          {record.isDuplicate && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                <span className="text-lg">⚠️</span>
                疑似重复授信
              </div>
              <p className="text-sm text-red-700">
                与记录ID #{record.duplicateWith} 的保证函编号、客户名称、金额一致，请复核确认。
              </p>
            </div>
          )}

          {record.pendingReason && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm font-medium text-yellow-800 mb-1">待处理原因</div>
              <p className="text-sm text-yellow-700">{record.pendingReason}</p>
            </div>
          )}

          {record.reviewReason && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-800 mb-1">复核原因</div>
              <p className="text-sm text-blue-700">{record.reviewReason}</p>
            </div>
          )}

          {record.remark && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-1">备注</div>
              <p className="text-sm text-gray-600">{record.remark}</p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">操作</h3>
            <div className="flex flex-wrap gap-2">
              {record.status !== 'approved' && record.status !== 'rejected' && record.status !== 'withdrawn' && record.status !== 'completed' && (
                <>
                  <button
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    onClick={() => setActionType('approve')}
                  >
                    通过
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                    onClick={() => setActionType('reject')}
                  >
                    驳回
                  </button>
                </>
              )}
              {record.status !== 'withdrawn' && (
                <button
                  className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  onClick={() => setActionType('withdraw')}
                >
                  撤回修正
                </button>
              )}
              {record.status === 'disputed' && (
                <button
                  className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  onClick={() => setActionType('resolve-dispute')}
                >
                  复核争议
                </button>
              )}
            </div>
          </div>

          {actionType && (
            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">
                {actionType === 'approve' && '确认通过'}
                {actionType === 'reject' && '确认驳回（必填原因）'}
                {actionType === 'withdraw' && '确认撤回（必填原因）'}
                {actionType === 'resolve-dispute' && '复核争议（必填原因）'}
              </h4>

              {actionType === 'resolve-dispute' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">复核结论</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={isDuplicate}
                        onChange={() => setIsDuplicate(true)}
                        className="rounded"
                      />
                      <span className="text-sm">确认为重复，并入记录 #{record.duplicateWith}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!isDuplicate}
                        onChange={() => setIsDuplicate(false)}
                        className="rounded"
                      />
                      <span className="text-sm">不重复，继续处理</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  操作人
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  原因
                  {(actionType === 'reject' || actionType === 'withdraw' || actionType === 'resolve-dispute') && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <textarea
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    actionType === 'resolve-dispute'
                      ? '请说明复核依据，例如：客户名称虽相同但为不同主体、金额一致为巧合等'
                      : '请说明原因...'
                  }
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={() => {
                    setActionType(null);
                    setReason('');
                  }}
                >
                  取消
                </button>
                <button
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  onClick={handleAction}
                  disabled={loading}
                >
                  {loading ? '处理中...' : '确认'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">操作历史</h3>
            <div className="space-y-3">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500">暂无操作记录</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="border-l-2 border-gray-200 pl-4 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">{log.operator}</span>
                      <span className="text-gray-600">{log.operation}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(log.createdAt)}
                    </div>
                    {log.reason && (
                      <div className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                        原因：{log.reason}
                      </div>
                    )}
                    {log.oldStatus && log.newStatus && (
                      <div className="text-xs text-gray-500 mt-1">
                        状态变更：{getStatusLabel(log.oldStatus)} → {getStatusLabel(log.newStatus)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
