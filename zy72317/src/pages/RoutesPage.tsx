import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Plus,
  RefreshCw,
  Download,
  FileText,
  AlertTriangle,
  Eye,
  Search,
  Filter,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { routeApi } from '../api/routeApi';
import { StatusBadge } from '../components/StatusBadge';
import { ChangeLogDrawer } from '../components/ChangeLogDrawer';
import type { PickingRoute, ChangeRecord } from '../../shared/types';
import dayjs from 'dayjs';

export const RoutesPage: React.FC = () => {
  const {
    currentUser,
    routes,
    setRoutes,
    selectedRouteId,
    setSelectedRouteId,
    showChangeLog,
    setShowChangeLog,
    setLoading,
    setError,
  } = useAppStore();

  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [supplementForm, setSupplementForm] = useState({
    orderNo: '',
    sku: '',
    quantity: 1,
    warehouseZone: 'A区',
  });
  const [selectedRouteChanges, setSelectedRouteChanges] = useState<ChangeRecord[]>([]);
  const [selectedRouteLineNos, setSelectedRouteLineNos] = useState({ original: 0, current: 0 });

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const res = await routeApi.getRoutes();
      setRoutes(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？删除后将标记为"已删除"状态，并可能导致编号断档。')) {
      return;
    }
    try {
      setLoading(true);
      await routeApi.deleteRoute(id, currentUser);
      await loadRoutes();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSupplement = async () => {
    try {
      setLoading(true);
      await routeApi.supplementRoute({
        routeData: supplementForm,
        operator: currentUser,
      });
      setShowSupplementModal(false);
      setSupplementForm({
        orderNo: '',
        sku: '',
        quantity: 1,
        warehouseZone: 'A区',
      });
      await loadRoutes();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setLoading(true);
      const res = await routeApi.recalculate({ operator: currentUser });
      alert(res.data.message);
      await loadRoutes();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const res = await routeApi.exportRoutes();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `拣货路线明细_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChanges = async (route: PickingRoute) => {
    try {
      setSelectedRouteId(route.id);
      setSelectedRouteChanges(route.changeLog);
      setSelectedRouteLineNos({
        original: route.originalLineNo,
        current: route.currentLineNo,
      });
      setShowChangeLog(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const filteredRoutes = routes.filter((route) => {
    const matchesSearch =
      route.routeData.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
      route.routeData.sku.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = filterStatus === 'all' || route.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const hasGap = routes.some((r) => r.status === 'gap_pending_review');
  const pendingRecalc = routes.filter((r) => r.status === 'supplement_pending_recalc').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">拣货路线明细</h2>
          <p className="mt-1 text-sm text-gray-500">
            查看和管理拣货路线数据，支持人工删除、补录和重算
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            导出明细
          </button>
          <button
            onClick={handleRecalculate}
            disabled={pendingRecalc === 0 && !hasGap}
            className={`inline-flex items-center px-4 py-2 font-medium transition-colors ${
              pendingRecalc === 0 && !hasGap
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            补录后重算
          </button>
          <button
            onClick={() => setShowSupplementModal(true)}
            className="inline-flex items-center px-4 py-2 bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            补录一行
          </button>
        </div>
      </div>

      {hasGap && (
        <div className="bg-warning-50 border-2 border-warning-400 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 mr-3 flex-shrink-0 animate-pulse" />
            <div>
              <h4 className="font-medium text-warning-800">检测到编号断档</h4>
              <p className="mt-1 text-sm text-warning-700">
                当前数据存在编号断档，已标记相关记录为"待教研组复核"状态。
                系统不会自动修正编号，请教研组复核后决定处理方式。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索订单号或SKU..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center">
          <Filter className="w-4 h-4 text-gray-400 mr-2" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">全部状态</option>
            <option value="normal">正常</option>
            <option value="gap_pending_review">编号断档-待复核</option>
            <option value="supplement_pending_recalc">补录待重算</option>
          </select>
        </div>
        <div className="text-sm text-gray-500">
          共 <span className="font-medium text-gray-900">{filteredRoutes.length}</span> 条记录
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">
                  原始行号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-24">
                  当前编号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  订单号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  数量
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  货区
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  拣货顺序
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  距离(米)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  预计时间(分钟)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  操作人
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-32">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无数据，请先导入边界值说明</p>
                  </td>
                </tr>
              ) : (
                filteredRoutes.map((route, index) => (
                  <tr
                    key={route.id}
                    className={`${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } ${route.status === 'gap_pending_review' ? 'bg-warning-50' : ''} hover:bg-gray-100`}
                  >
                    <td className="sticky left-0 px-4 py-3 text-sm font-mono bg-inherit">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-primary-100 text-primary-800 text-xs font-bold">
                        {route.originalLineNo === -1 ? '补录' : route.originalLineNo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {route.currentLineNo}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{route.routeData.orderNo}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{route.routeData.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center">{route.routeData.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{route.routeData.warehouseZone}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center">{route.routeData.pickingSequence}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{route.routeData.distance}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{route.routeData.estimatedTime}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={route.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{route.operator}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleViewChanges(route)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="查看变更历史"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(route.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="删除行"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSupplementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSupplementModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="font-serif text-xl font-bold text-gray-900 mb-4">补录新行</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">订单号</label>
                <input
                  type="text"
                  value={supplementForm.orderNo}
                  onChange={(e) => setSupplementForm({ ...supplementForm, orderNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="如：ORD-0011"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={supplementForm.sku}
                  onChange={(e) => setSupplementForm({ ...supplementForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="如：SKU-000011"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input
                    type="number"
                    min="1"
                    value={supplementForm.quantity}
                    onChange={(e) => setSupplementForm({ ...supplementForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">货区</label>
                  <select
                    value={supplementForm.warehouseZone}
                    onChange={(e) => setSupplementForm({ ...supplementForm, warehouseZone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="A区">A区</option>
                    <option value="B区">B区</option>
                    <option value="C区">C区</option>
                    <option value="D区">D区</option>
                    <option value="E区">E区</option>
                  </select>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                补录后系统将自动设置状态为"补录待重算"，需要点击"补录后重算"按钮重新计算拣货路线。
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSupplementModal(false)}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSupplement}
                className="px-4 py-2 bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
              >
                确认补录
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangeLogDrawer
        isOpen={showChangeLog}
        onClose={() => {
          setShowChangeLog(false);
          setSelectedRouteId(null);
        }}
        changes={selectedRouteChanges}
        originalLineNo={selectedRouteLineNos.original}
        currentLineNo={selectedRouteLineNos.current}
      />
    </div>
  );
};
