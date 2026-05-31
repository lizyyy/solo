import { useEffect, useState } from 'react';
import { useReviewStore } from '../store/useReviewStore';
import { formatDateTime } from '../utils/date';
import { shortHash } from '../utils/hash';
import { History, User, Clock, Hash, FileText, Eye, RotateCcw } from 'lucide-react';
import type { OperationLog as OperationLogType } from '../types';

const actionLabels: Record<string, string> = {
  import: '数据导入',
  detect_anomaly: '异常检测',
  confirm: '确认异常',
  reject: '驳回异常',
  adjust: '调整记录',
  add_note: '添加备注',
  export: '导出数据',
};

export function AuditLog() {
  const { initializeData, operations, refunds, selectRefund, resetData } = useReviewStore();
  const [selectedLog, setSelectedLog] = useState<OperationLogType | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterOperator, setFilterOperator] = useState<string>('all');

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const operators = Array.from(new Set(operations.map((o) => o.operator)));

  const filteredLogs = operations.filter((log) => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterOperator !== 'all' && log.operator !== filterOperator) return false;
    return true;
  });

  const getRefundInfo = (refundId: string) => {
    return refunds.find((r) => r.id === refundId);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-bg-border bg-bg-secondary">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-text-secondary" />
            <h2 className="text-data-base font-semibold text-text-primary">状态回看</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-data-xs text-text-muted">共</span>
              <span className="font-mono font-semibold text-data-sm text-text-primary">
                {filteredLogs.length}
              </span>
              <span className="text-data-xs text-text-muted">条操作记录</span>
            </div>
            <button
              onClick={() => {
                if (confirm('确定要重置所有数据吗？此操作将清除所有操作记录。')) {
                  resetData();
                }
              }}
              className="btn-secondary flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置数据
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-data-sm text-text-secondary">操作类型：</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="input-field w-36"
            >
              <option value="all">全部操作</option>
              {Object.entries(actionLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-data-sm text-text-secondary">操作人：</span>
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="input-field w-36"
            >
              <option value="all">全部操作人</option>
              {operators.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
              <History className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-data-sm">暂无操作记录</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => {
                const refund = getRefundInfo(log.refundId);
                const isSelected = selectedLog?.id === log.id;

                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-bg-tertiary border-status-normal/50'
                        : 'bg-bg-secondary border-bg-border hover:bg-bg-tertiary/50'
                    }`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          log.action === 'import'
                            ? 'bg-blue-400'
                            : log.action === 'detect_anomaly'
                            ? 'bg-status-pending'
                            : log.action === 'confirm'
                            ? 'bg-status-normal'
                            : log.action === 'reject'
                            ? 'bg-status-anomaly'
                            : 'bg-text-muted'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-data-sm font-medium text-text-primary">
                            {actionLabels[log.action] || log.action}
                          </span>
                          <span className="text-data-xs text-text-muted">
                            {refund?.serialNo || log.refundId}
                          </span>
                          {refund && (
                            <span className="text-data-xs text-text-muted truncate">
                              {refund.supplierName}
                            </span>
                          )}
                        </div>
                        <p className="text-data-xs text-text-secondary line-clamp-1">
                          {log.remark}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-data-xs text-text-muted">{log.operator}</p>
                        <p className="text-data-xs text-text-muted font-mono">
                          {formatDateTime(log.operatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedLog && (
          <div className="w-96 border-l border-bg-border bg-bg-secondary p-4 overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-data-sm font-medium text-text-primary">操作详情</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <Hash className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <DetailRow
                icon={Hash}
                label="操作ID"
                value={selectedLog.id}
                mono
              />
              <DetailRow
                icon={User}
                label="操作人"
                value={selectedLog.operator}
              />
              <DetailRow
                icon={FileText}
                label="操作类型"
                value={actionLabels[selectedLog.action] || selectedLog.action}
              />
              <DetailRow
                icon={FileText}
                label="关联记录"
                value={selectedLog.refundId}
                mono
              />
              <DetailRow
                icon={Clock}
                label="操作时间"
                value={formatDateTime(selectedLog.operatedAt)}
              />
              <DetailRow
                icon={FileText}
                label="操作说明"
                value={selectedLog.remark}
              />

              {selectedLog.oldValue && (
                <div>
                  <p className="text-data-xs text-text-secondary mb-1">变更前状态</p>
                  <pre className="p-2 bg-bg-primary rounded text-data-xs text-text-muted font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <p className="text-data-xs text-text-secondary mb-1">变更后状态</p>
                  <pre className="p-2 bg-bg-primary rounded text-data-xs text-text-muted font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-data-xs text-text-secondary mb-1">数据快照哈希</p>
                <p className="font-mono text-data-xs text-text-primary break-all">
                  {selectedLog.snapshotHash}
                </p>
                <p className="text-data-xs text-text-muted mt-1">
                  短哈希: {shortHash(selectedLog.snapshotHash)}
                </p>
              </div>

              <button
                onClick={() => selectRefund(selectedLog.refundId)}
                className="w-full btn-secondary flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                查看关联记录
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-data-xs text-text-secondary">{label}</span>
      </div>
      <p className={`text-data-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
