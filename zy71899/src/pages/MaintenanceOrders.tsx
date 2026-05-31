import React, { useEffect, useState } from 'react';
import { Wrench, Clock, User, ChevronRight, Plus, AlertTriangle } from 'lucide-react';
import { useRecordsStore } from '@/stores/recordsStore';
import { useUIStore } from '@/stores/uiStore';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/utils/helpers';
import type { MaintenanceOrder } from '@/types';

export const MaintenanceOrders: React.FC = () => {
  const { maintenanceOrders, loadMaintenanceOrders } = useRecordsStore();
  const { navigateToSource } = useUIStore();
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);

  useEffect(() => {
    loadMaintenanceOrders();
  }, []);

  const handleViewSource = (order: MaintenanceOrder) => {
    navigateToSource({
      sourceType: 'maintenance_order',
      sourceId: order.id,
      sourceVersion: 1,
      sourceLine: 1,
    });
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-alert-orange/20 text-alert-orange',
    'in-progress': 'bg-tech-blue/20 text-tech-blue',
    completed: 'bg-signal-green/20 text-signal-green',
  };

  const statusLabels: Record<string, string> = {
    pending: '待处理',
    'in-progress': '进行中',
    completed: '已完成',
  };

  const sortedOrders = [...maintenanceOrders].sort((a, b) => {
    const order = { pending: 0, 'in-progress': 1, completed: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-text">维修工单</h1>
          <p className="text-industrial-text-muted mt-1">
            设备故障维修和维护记录
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建工单
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {sortedOrders.length === 0 ? (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-12 text-center">
              <Wrench className="w-12 h-12 text-industrial-text-dim mx-auto mb-3" />
              <p className="text-industrial-text-muted">暂无维修工单</p>
            </div>
          ) : (
            sortedOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-industrial-bg-light border rounded-lg p-5 cursor-pointer transition-colors ${
                  selectedOrder?.id === order.id
                    ? 'border-tech-blue'
                    : 'border-industrial-border hover:border-tech-blue/50'
                }`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-tech-blue text-sm">
                      {order.orderNo}
                    </span>
                    <StatusBadge
                      type="maintenance"
                      status={order.status}
                    />
                    {order.priority === 'high' && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-danger-red/20 text-danger-red text-xs rounded">
                        <AlertTriangle className="w-3 h-3" />
                        紧急
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewSource(order);
                    }}
                    className="p-1.5 hover:bg-industrial-bg rounded transition-colors text-industrial-text-muted hover:text-tech-blue"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-industrial-text font-medium mb-2">
                  {order.equipment}
                </p>

                <p className="text-sm text-industrial-text-muted mb-3 line-clamp-2">
                  {order.faultDescription}
                </p>

                <div className="flex items-center gap-4 text-sm text-industrial-text-muted">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {order.technician}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDateTime(order.startTime)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          {selectedOrder ? (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5 sticky top-6">
              <h3 className="text-sm font-medium text-industrial-text mb-4">工单详情</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-industrial-text-muted">工单号</span>
                  <span className="text-sm font-mono text-tech-blue">{selectedOrder.orderNo}</span>
                </div>

                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">设备</p>
                  <p className="text-sm text-industrial-text">{selectedOrder.equipment}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-industrial-text-muted">状态</span>
                  <StatusBadge type="maintenance" status={selectedOrder.status} />
                </div>

                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">维修人员</p>
                  <p className="text-sm text-industrial-text">{selectedOrder.technician}</p>
                </div>

                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">故障描述</p>
                  <p className="text-sm text-industrial-text whitespace-pre-wrap">
                    {selectedOrder.faultDescription}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">维修内容</p>
                  <p className="text-sm text-industrial-text whitespace-pre-wrap">
                    {selectedOrder.maintenanceContent}
                  </p>
                </div>

                {selectedOrder.partsReplaced && (
                  <div>
                    <p className="text-xs text-industrial-text-muted mb-1">更换部件</p>
                    <p className="text-sm text-industrial-text whitespace-pre-wrap">
                      {selectedOrder.partsReplaced}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-industrial-bg rounded-lg">
                    <p className="text-xs text-industrial-text-muted mb-1">开始时间</p>
                    <p className="text-xs font-mono text-industrial-text">
                      {formatDateTime(selectedOrder.startTime)}
                    </p>
                  </div>
                  <div className="p-3 bg-industrial-bg rounded-lg">
                    <p className="text-xs text-industrial-text-muted mb-1">结束时间</p>
                    <p className="text-xs font-mono text-industrial-text">
                      {selectedOrder.endTime ? formatDateTime(selectedOrder.endTime) : '进行中'}
                    </p>
                  </div>
                </div>

                {selectedOrder.relatedPressureValues && (
                  <div>
                    <p className="text-xs text-industrial-text-muted mb-2">相关压力数据</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.relatedPressureValues.map((val, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-xs font-mono rounded ${
                            val > 10
                              ? 'bg-danger-red/20 text-danger-red'
                              : val > 8
                              ? 'bg-alert-orange/20 text-alert-orange'
                              : 'bg-signal-green/20 text-signal-green'
                          }`}
                        >
                          {val.toFixed(1)} MPa
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleViewSource(selectedOrder)}
                  className="w-full btn-secondary text-sm"
                >
                  追溯原始记录
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-8 text-center sticky top-6">
              <Wrench className="w-10 h-10 text-industrial-text-dim mx-auto mb-3" />
              <p className="text-industrial-text-muted text-sm">
                选择左侧工单查看详情
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
