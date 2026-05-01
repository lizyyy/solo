import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, User, FileText, Download, Upload, RefreshCw, X, Check } from 'lucide-react';
import type { Order, OrderStatus, Technician, CreateOrderRequest } from './types';
import { orderApi, technicianApi, csvApi } from './services/api';
import { STATUS_LABELS } from './constants/statusFlow';
import { OrderCard } from './components/OrderCard';
import { CreateOrderForm } from './components/CreateOrderForm';
import { OrderDrawer } from './components/OrderDrawer';

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    technician_id: '',
    status: ''
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message?: string;
    successCount?: number;
    errors?: string[];
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ordersData, techniciansData] = await Promise.all([
        orderApi.getOrders({
          date: filters.date || undefined,
          technician_id: filters.technician_id ? parseInt(filters.technician_id) : undefined,
          status: (filters.status as OrderStatus) || undefined
        }),
        technicianApi.getAll()
      ]);
      setOrders(ordersData);
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter(order => order.status === status);
  };

  const handleCreateOrder = async (data: CreateOrderRequest) => {
    try {
      setIsCreating(true);
      await orderApi.createOrder(data);
      setShowCreateForm(false);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '创建工单失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (orderId: number, newStatus: OrderStatus) => {
    try {
      await orderApi.updateStatus(orderId, newStatus);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '更新状态失败');
    }
  };

  const handleExportToday = async () => {
    try {
      await csvApi.exportToday();
    } catch (error) {
      alert(error instanceof Error ? error.message : '导出失败');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      setIsImporting(true);
      const result = await csvApi.import(importFile);
      setImportResult({ success: true, ...result });
      setImportFile(null);
      fetchData();
    } catch (error) {
      setImportResult({ success: false, message: error instanceof Error ? error.message : '导入失败' });
    } finally {
      setIsImporting(false);
    }
  };

  const statusCounts = STATUS_LABELS.reduce((acc, status) => {
    acc[status] = getOrdersByStatus(status).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const totalActive = orders.filter(o => !['已完成', '已取消'].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">手机维修店工单系统</h1>
                <p className="text-sm text-gray-500">
                  今日活跃工单: <span className="font-semibold text-blue-600">{totalActive}</span> 个
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportToday}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  导出当日
                </button>
                <button
                  onClick={() => {
                    setShowImportModal(true);
                    setImportResult(null);
                    setImportFile(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  导入
                </button>
                <button
                  onClick={fetchData}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="刷新"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新建工单
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="input-field text-sm w-40"
              />
            </div>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <select
                value={filters.technician_id}
                onChange={(e) => setFilters({ ...filters, technician_id: e.target.value })}
                className="select-field text-sm w-40"
              >
                <option value="">全部师傅</option>
                {technicians.map(tech => (
                  <option key={tech.id} value={tech.id}>{tech.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="select-field text-sm w-36"
              >
                <option value="">全部状态</option>
                {STATUS_LABELS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setFilters({
                date: new Date().toISOString().split('T')[0],
                technician_id: '',
                status: ''
              })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              重置筛选
            </button>
          </div>

          <div className="flex items-center gap-4 mt-3 overflow-x-auto pb-2">
            {STATUS_LABELS.map(status => (
              <button
                key={status}
                onClick={() => setFilters(prev => ({
                  ...prev,
                  status: prev.status === status ? '' : status
                }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                  filters.status === status
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                  filters.status === status
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {statusCounts[status]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {STATUS_LABELS.map(status => {
              const statusOrders = getOrdersByStatus(status);
              return (
                <div key={status} className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`text-sm font-semibold status-badge status-${status}`}>
                      {status}
                    </h2>
                    <span className="text-xs text-gray-500">
                      {statusOrders.length} 个
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin pr-1">
                    {statusOrders.length === 0 ? (
                      <div className="card p-6 text-center">
                        <p className="text-sm text-gray-400">暂无工单</p>
                      </div>
                    ) : (
                      statusOrders.map(order => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onView={setSelectedOrder}
                          onUpdateStatus={handleUpdateStatus}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showCreateForm && (
        <CreateOrderForm
          technicians={technicians}
          onSubmit={handleCreateOrder}
          onClose={() => setShowCreateForm(false)}
          isLoading={isCreating}
        />
      )}

      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          technicians={technicians}
          onClose={() => setSelectedOrder(null)}
          onUpdate={fetchData}
        />
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="drawer-overlay" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">导入旧工单</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {!importResult ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      请上传 CSV 格式的工单文件。文件需要包含以下列：
                    </p>
                    <p className="text-xs text-gray-500">
                      客户姓名、客户电话、设备品牌、设备型号、故障描述（必填）<br/>
                      可选列：IMEI、维修师傅、报价、预计完成时间、状态、创建时间
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                    {importFile ? (
                      <div>
                        <FileText className="w-10 h-10 text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-900">{importFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </p>
                        <button
                          onClick={() => setImportFile(null)}
                          className="mt-2 text-sm text-red-500 hover:text-red-600"
                        >
                          重新选择
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">点击或拖拽文件到此处</p>
                        <p className="text-xs text-gray-400 mt-1">支持 .csv 格式</p>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  {importResult.success ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">导入成功</h4>
                      <p className="text-sm text-gray-600 mb-2">{importResult.message}</p>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-50 rounded-lg text-left">
                          <p className="text-sm font-medium text-red-800 mb-2">错误详情：</p>
                          <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                            {importResult.errors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X className="w-8 h-8 text-red-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">导入失败</h4>
                      <p className="text-sm text-gray-600">{importResult.message}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100">
              {importResult ? (
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResult(null);
                  }}
                  className="btn-primary"
                >
                  关闭
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="btn-secondary"
                    disabled={isImporting}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!importFile || isImporting}
                    className="btn-primary"
                  >
                    {isImporting ? '导入中...' : '开始导入'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
