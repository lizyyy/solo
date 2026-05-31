import { useEffect, useState } from 'react';
import { useReviewStore } from '../store/useReviewStore';
import { StatusTag, AnomalyTypeBadge } from '../components/StatusTag';
import { formatDate, formatDateTime } from '../utils/date';
import { getAnomalyTypeLabel, getSeverityLabel } from '../utils/anomalyDetector';
import { AlertTriangle, Clock, Users, Filter, Eye } from 'lucide-react';
import type { Anomaly, RefundItem } from '../types';

export function AnomalyCenter() {
  const { initializeData, refunds, selectRefund, selectedRefundId } = useReviewStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const allAnomalies = refunds.flatMap((r) =>
    r.anomalies.map((a) => ({ ...a, refund: r }))
  );

  const filteredAnomalies = allAnomalies.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  const groupedByType = filteredAnomalies.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = [];
    acc[a.type].push(a);
    return acc;
  }, {} as Record<string, (Anomaly & { refund: RefundItem })[]>);

  const stats = {
    total: allAnomalies.length,
    open: allAnomalies.filter((a) => a.status === 'open').length,
    confirmed: allAnomalies.filter((a) => a.status === 'confirmed').length,
    rejected: allAnomalies.filter((a) => a.status === 'rejected').length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-bg-border bg-bg-secondary">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-status-pending" />
            <h2 className="text-data-base font-semibold text-text-primary">异常检测中心</h2>
          </div>
          <div className="flex items-center gap-4">
            <Stat label="总计" value={stats.total} />
            <Stat label="待处理" value={stats.open} color="text-status-pending" />
            <Stat label="已确认" value={stats.confirmed} color="text-status-normal" />
            <Stat label="已驳回" value={stats.rejected} color="text-status-anomaly" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-data-sm text-text-secondary">异常类型：</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field w-40"
            >
              <option value="all">全部类型</option>
              <option value="duplicate">重复入账</option>
              <option value="cross_period">手续费跨期</option>
              <option value="pending">退款挂账</option>
              <option value="late_attachment">晚到附件</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-data-sm text-text-secondary">处理状态：</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field w-32"
            >
              <option value="all">全部状态</option>
              <option value="open">待处理</option>
              <option value="confirmed">已确认</option>
              <option value="rejected">已驳回</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {filteredAnomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <AlertTriangle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-data-sm">暂无符合条件的异常记录</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByType).map(([type, anomalies]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <AnomalyTypeBadge type={type} />
                  <span className="text-data-sm font-medium text-text-primary">
                    {getAnomalyTypeLabel(type as any)}
                  </span>
                  <span className="text-data-xs text-text-muted">
                    共 {anomalies.length} 条
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-data-sm">
                    <thead>
                      <tr className="border-b border-bg-border">
                        <th className="py-2 px-3 font-medium text-text-secondary">流水号</th>
                        <th className="py-2 px-3 font-medium text-text-secondary">供应商</th>
                        <th className="py-2 px-3 font-medium text-text-secondary">异常描述</th>
                        <th className="py-2 px-3 font-medium text-text-secondary">严重程度</th>
                        <th className="py-2 px-3 font-medium text-text-secondary">检测时间</th>
                        <th className="py-2 px-3 font-medium text-text-secondary">状态</th>
                        <th className="py-2 px-3 font-medium text-text-secondary w-20">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.map((anomaly) => (
                        <tr
                          key={anomaly.id}
                          className={`border-b border-bg-border/50 hover:bg-bg-tertiary/30 transition-colors ${
                            selectedRefundId === anomaly.refundId ? 'bg-bg-tertiary/50' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono text-text-primary">
                            {anomaly.refund.serialNo}
                          </td>
                          <td className="py-3 px-3 text-text-secondary">
                            {anomaly.refund.supplierName}
                          </td>
                          <td className="py-3 px-3 text-text-primary max-w-xs truncate">
                            {anomaly.description}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-data-xs ${
                                anomaly.severity === 'high'
                                  ? 'text-status-anomaly'
                                  : anomaly.severity === 'medium'
                                  ? 'text-status-pending'
                                  : 'text-text-muted'
                              }`}
                            >
                              {getSeverityLabel(anomaly.severity)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-text-secondary font-mono text-data-xs">
                            {formatDateTime(anomaly.detectedAt)}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-data-xs ${
                                anomaly.status === 'open'
                                  ? 'text-status-pending'
                                  : anomaly.status === 'confirmed'
                                  ? 'text-status-normal'
                                  : 'text-status-anomaly'
                              }`}
                            >
                              {anomaly.status === 'open'
                                ? '待处理'
                                : anomaly.status === 'confirmed'
                                ? '已确认'
                                : '已驳回'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => selectRefund(anomaly.refundId)}
                              className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
                              title="查看详情"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-data-xs text-text-muted">{label}:</span>
      <span className={`font-mono font-semibold text-data-sm ${color || 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}
