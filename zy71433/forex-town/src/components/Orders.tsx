import React, { useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, Truck, Package, XCircle, UserX, FileText, Edit3 } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency, formatPercent, getOrderStatusLabel, getOrderStatusColor, formatDate } from '../utils';
import type { Order } from '../types';

export const Orders: React.FC = () => {
  const { state, dispatch } = useGame();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtOrder, setDebtOrder] = useState<Order | null>(null);

  const handleConfirmOrder = (orderId: string) => {
    dispatch({ type: 'CONFIRM_ORDER', payload: orderId });
  };

  const handleShipOrder = (orderId: string) => {
    dispatch({ type: 'SHIP_ORDER', payload: orderId });
  };

  const handleCompleteOrder = (orderId: string) => {
    dispatch({ type: 'COMPLETE_ORDER', payload: orderId });
  };

  const handleDebtCollection = (order: Order) => {
    setDebtOrder(order);
    setShowDebtModal(true);
  };

  const processDebtAction = (action: 'write_off' | 'negotiate') => {
    if (!debtOrder) return;
    dispatch({
      type: 'PROCESS_DEBT_COLLECTION',
      payload: { orderId: debtOrder.id, action },
    });
    setShowDebtModal(false);
    setDebtOrder(null);
  };

  const getStatusIcon = (status: Order['status']) => {
    const icons = {
      pending: Clock,
      confirmed: CheckCircle,
      shipped: Truck,
      delivered: Package,
      defaulted: XCircle,
      cancelled: XCircle,
    };
    return icons[status];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">订单管理</h2>
          <p className="text-gray-500 mt-1">管理所有进出口订单，处理异常情况</p>
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'defaulted'].map((filter) => (
            <span
              key={filter}
              className="px-3 py-1 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200"
            >
              {filter === 'all' ? '全部' : getOrderStatusLabel(filter as Order['status'])}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: '待确认', count: state.orders.filter((o) => o.status === 'pending').length, color: 'bg-yellow-500' },
          { label: '已确认', count: state.orders.filter((o) => o.status === 'confirmed').length, color: 'bg-blue-500' },
          { label: '已发货', count: state.orders.filter((o) => o.status === 'shipped').length, color: 'bg-purple-500' },
          { label: '已完成', count: state.orders.filter((o) => o.status === 'delivered').length, color: 'bg-green-500' },
          { label: '已违约', count: state.orders.filter((o) => o.status === 'defaulted').length, color: 'bg-red-500' },
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${stat.color}`} />
              <span className="text-sm text-gray-500">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">订单信息</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">商品</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">金额</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">状态</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">违约风险</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">异常</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {state.orders.map((order) => {
              const StatusIcon = getStatusIcon(order.status);
              return (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{order.orderNo}</p>
                        <p className="text-sm text-gray-500">{order.customerName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-900">{order.productName}</p>
                    <p className="text-sm text-gray-500">× {order.quantity} 件</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </p>
                    <p className="text-sm text-gray-500">
                      ≈ {formatCurrency(order.totalAmount * state.currentRate.rate)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(
                        order.status
                      )}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {getOrderStatusLabel(order.status)}
                    </span>
                    {order.actualDeliveryRound && (
                      <p className="text-xs text-gray-400 mt-1">
                        第{order.actualDeliveryRound}回合交付
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            order.defaultRisk >= 0.2
                              ? 'bg-red-500'
                              : order.defaultRisk >= 0.1
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${order.defaultRisk * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{formatPercent(order.defaultRisk)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {order.hasMissingFields && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> 字段缺失
                        </span>
                      )}
                      {order.isLateSubmission && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3" /> 延迟提交
                        </span>
                      )}
                      {order.modifiedBy && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          <Edit3 className="w-3 h-3" /> 已修改
                        </span>
                      )}
                      {!order.hasMissingFields && !order.isLateSubmission && !order.modifiedBy && (
                        <span className="text-xs text-gray-400">无异常</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {order.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmOrder(order.id);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          确认订单
                        </button>
                      )}
                      {order.status === 'confirmed' && !order.hasMissingFields && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShipOrder(order.id);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                        >
                          发货
                        </button>
                      )}
                      {order.status === 'shipped' && order.expectedDeliveryRound <= state.currentRound && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteOrder(order.id);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          确认收款
                        </button>
                      )}
                      {order.status === 'defaulted' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDebtCollection(order);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                        >
                          <UserX className="w-3 h-3" /> 催收
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl p-6 w-[600px] shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedOrder.orderNo}</h3>
                <p className="text-gray-500 mt-1">{selectedOrder.customerName}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">商品名称</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.productName}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">数量</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.quantity} 件</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">单价</p>
                  <p className="font-medium text-gray-900 mt-1">
                    {formatCurrency(selectedOrder.unitPrice, selectedOrder.currency)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">总金额</p>
                  <p className="font-bold text-primary-600 mt-1">
                    {formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-blue-700">当前汇率</span>
                  <span className="font-medium text-blue-900">{state.currentRate.rate.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">折算人民币</span>
                  <span className="font-bold text-blue-900">
                    {formatCurrency(selectedOrder.totalAmount * state.currentRate.rate)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">创建回合</p>
                  <p className="font-medium text-gray-900 mt-1">第 {selectedOrder.createRound} 回合</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">预计交付回合</p>
                  <p className="font-medium text-gray-900 mt-1">第 {selectedOrder.expectedDeliveryRound} 回合</p>
                </div>
              </div>

              {(selectedOrder.hasMissingFields || selectedOrder.isLateSubmission || selectedOrder.modifiedBy) && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> 异常记录
                  </h4>
                  <div className="space-y-2">
                    {selectedOrder.hasMissingFields && (
                      <div>
                        <p className="text-sm font-medium text-red-700">缺失字段</p>
                        <p className="text-sm text-red-600">{selectedOrder.missingFields?.join('、')}</p>
                      </div>
                    )}
                    {selectedOrder.isLateSubmission && (
                      <div>
                        <p className="text-sm font-medium text-red-700">延迟提交原因</p>
                        <p className="text-sm text-red-600">{selectedOrder.lateReason}</p>
                      </div>
                    )}
                    {selectedOrder.modifiedBy && (
                      <div>
                        <p className="text-sm font-medium text-red-700">修改记录</p>
                        <p className="text-sm text-red-600">
                          {selectedOrder.modifiedBy} 于 {formatDate(selectedOrder.lastModified!)} 修改
                        </p>
                        <p className="text-sm text-red-600">原因：{selectedOrder.modificationReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.remarks && (
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                  <h4 className="font-semibold text-yellow-900 mb-2">备注</h4>
                  <p className="text-sm text-yellow-800">{selectedOrder.remarks}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showDebtModal && debtOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">应收账款催收</h3>
            <p className="text-gray-500 mb-6">{debtOrder.customerName} - {debtOrder.orderNo}</p>

            <div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-700">拖欠金额</span>
                <span className="font-bold text-red-900">
                  {formatCurrency(debtOrder.totalAmount, debtOrder.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">折算人民币</span>
                <span className="font-bold text-red-900">
                  {formatCurrency(debtOrder.totalAmount * state.currentRate.rate)}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">请选择催收方式：</p>

            <div className="space-y-3">
              <button
                onClick={() => processDebtAction('negotiate')}
                className="w-full p-4 text-left bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors"
              >
                <p className="font-semibold text-yellow-900">协商回款（60%）</p>
                <p className="text-sm text-yellow-700 mt-1">
                  与客户协商减免部分债务，预计回收 {formatCurrency(debtOrder.totalAmount * 0.6, debtOrder.currency)}
                </p>
              </button>

              <button
                onClick={() => processDebtAction('write_off')}
                className="w-full p-4 text-left bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
              >
                <p className="font-semibold text-red-900">计提坏账损失</p>
                <p className="text-sm text-red-700 mt-1">
                  确认无法回收，全额计入损失 {formatCurrency(debtOrder.totalAmount * state.currentRate.rate)}
                </p>
              </button>
            </div>

            <button
              onClick={() => {
                setShowDebtModal(false);
                setDebtOrder(null);
              }}
              className="w-full mt-4 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
