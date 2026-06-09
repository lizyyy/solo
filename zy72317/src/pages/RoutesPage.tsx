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
  CheckSquare,
  UserCheck,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { routeApi } from '../api/routeApi';
import { StatusBadge } from '../components/StatusBadge';
import { ChangeLogDrawer } from '../components/ChangeLogDrawer';
import type { PickingRoute, ChangeRecord, GapRecord, GapResolutionType } from '../../shared/types';
import { GAP_RESOLUTION_LABELS } from '../../shared/types';
import dayjs from 'dayjs';

export const RoutesPage: React.FC = () => {
  const {
    currentUser,
    routes,
    openGaps,
    openGapCount,
    setRoutesData,
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
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedGap, setSelectedGap] = useState<GapRecord | null>(null);
  const [reviewForm, setReviewForm] = useState({
    resolutionType: 'accept_gap' as GapResolutionType,
    resolutionRemark: '',
    nextHandler: '',
  });
  const [pendingRecalc, setPendingRecalc] = useState(0);

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    setPendingRecalc(routes.filter(r => r.status === 'supplement_pending_recalc').length);
  }, [routes]);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const res = await routeApi.getRoutes();
      setRoutesData(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？删除后将标记为"已删除"状态，并可能导致编号断档。断档不会自动修正，留给教研组复核。')) {
      return;
    }
    try {
      setLoading(true);
      const res = await routeApi.deleteRoute(id, currentUser);
      setRoutesData(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSupplement = async () => {
    try {
      setLoading(true);
      const res = await routeApi.supplementRoute({
        routeData: supplementForm,
        operator: currentUser,
      });
      setRoutesData(res.data);
      setShowSupplementModal(false);
      setSupplementForm({
        orderNo: '',
        sku: '',
        quantity: 1,
        warehouseZone: 'A区',
      });
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
      setRoutesData({
        routes: res.data.routes,
        openGaps: res.data.openGaps,
        openGapCount: res.data.openGapCount,
      });
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

  const handleOpenReviewModal = (gap: GapRecord) => {
    setSelectedGap(gap);
    setReviewForm({
      resolutionType: 'accept_gap',
      resolutionRemark: '',
      nextHandler: '',
    });
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedGap) return;
    if (!reviewForm.resolutionRemark.trim()) {
      alert('请填写复核说明，说明处理原因');
      return;
    }
    try {
      setLoading(true);
      const res = await routeApi.reviewGap({
        gapId: selectedGap.id,
        reviewedBy: currentUser,
        resolutionType: reviewForm.resolutionType,
        resolutionRemark: reviewForm.resolutionRemark.trim(),
        nextHandler: reviewForm.nextHandler.trim() || undefined,
      });
      alert(res.data.message);
      setRoutesData({
        routes: routes,
        openGaps: res.data.openGaps,
        openGapCount: res.data.openGapCount,
      });
      await loadRoutes();
      setShowReviewModal(false);
      setSelectedGap(null);
    } catch (e: any) {
      alert(e.response?.data?.message || e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRoutes = routes.filter((route) => {
    const matchesSearch =
      route.routeData.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
      route.routeData.sku.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = filterStatus === 'all' || route.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const openGapRouteIds = new Set<string>();
  for (const gap of openGaps) {
    if (gap.beforeRouteId) openGapRouteIds.add(gap.beforeRouteId);
    if (gap.afterRouteId) openGapRouteIds.add(gap.afterRouteId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-gray-900">拣货路线明细</h2>
          <p className="mt-1 text-sm text-gray-500">
            查看和管理拣货路线数据，支持人工删除、补录和重算。断档记录独立存储，由教研组复核
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
            disabled={pendingRecalc === 0}
            className={`inline-flex items-center px-4 py-2 font-medium transition-colors ${
              pendingRecalc === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            补录后重算{pendingRecalc > 0 ? `(${pendingRecalc}条)` : ''}
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

      {openGapCount > 0 && (
        <div className="bg-warning-50 border-2 border-warning-400 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 mr-3 flex-shrink-0 animate-pulse" />
            <div className="flex-1">
              <h4 className="font-medium text-warning-800 flex items-center">
                检测到编号断档：{openGapCount}处待教研组复核
                <span className="ml-2 text-xs bg-warning-200 text-warning-900 px-2 py-0.5 rounded">
                  系统不会自动修正编号
                </span>
              </h4>
              <div className="mt-3 space-y-2">
                {openGaps.slice(0, 5).map((gap) => (
                  <div
                    key={gap.id}
                    className="flex items-center justify-between bg-white/60 rounded p-3 border border-warning-200"
                  >
                    <div className="flex items-center space-x-4">
                      <AlertTriangle className="w-4 h-4 text-warning-500" />
                      <div>
                        <span className="text-sm text-warning-800 font-mono">
                          编号 {gap.beforeLineNo} → {gap.afterLineNo}，
                          缺失 <span className="font-bold">{gap.missingCount}</span> 条
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          检测于 {dayjs(gap.detectedAt).format('MM-DD HH:mm')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenReviewModal(gap)}
                      className="inline-flex items-center px-3 py-1.5 bg-warning-600 text-white text-sm font-medium hover:bg-warning-700 rounded transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                      教研组复核
                    </button>
                  </div>
                ))}
                {openGaps.length > 5 && (
                  <p className="text-xs text-gray-500 text-center pt-1">
                    还有 {openGaps.length - 5} 处断档未展示...
                  </p>
                )}
              </div>
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
            <option value="reviewed_resolved">断档已复核</option>
          </select>
        </div>
        <div className="text-sm text-gray-500">
          共 <span className="font-medium text-gray-900">{filteredRoutes.length}</span> 条记录
          {openGapCount > 0 && (
            <span className="ml-2 text-warning-600">
              · <span className="font-medium">{openGapCount}</span> 处断档待复核
            </span>
          )}
          {pendingRecalc > 0 && (
            <span className="ml-2 text-blue-600">
              · <span className="font-medium">{pendingRecalc}</span> 条补录待重算
            </span>
          )}
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
                filteredRoutes.map((route, index) => {
                  const isGapAdjacent = openGapRouteIds.has(route.id);
                  const hasReviewInfo = !!route.gapReviewInfo;
                  return (
                    <tr
                      key={route.id}
                      className={`${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } ${isGapAdjacent && route.status !== 'reviewed_resolved' ? 'bg-warning-50' : ''} ${
                        route.status === 'reviewed_resolved' ? 'bg-indigo-50/40' : ''
                      } hover:bg-gray-100 transition-colors`}
                    >
                      <td className="sticky left-0 px-4 py-3 text-sm font-mono bg-inherit">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-primary-100 text-primary-800 text-xs font-bold">
                          {route.originalLineNo === -1 ? '补录' : route.originalLineNo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                        <div className="flex items-center space-x-1">
                          <span>{route.currentLineNo}</span>
                          {isGapAdjacent && route.status !== 'reviewed_resolved' && (
                            <span className="text-warning-500" aria-label="断档相邻记录">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{route.routeData.orderNo}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{route.routeData.sku}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">{route.routeData.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{route.routeData.warehouseZone}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">{route.routeData.pickingSequence}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{route.routeData.distance}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{route.routeData.estimatedTime}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1">
                          <StatusBadge status={route.status} />
                          {hasReviewInfo && (
                            <span className="text-xs text-indigo-600 flex items-center">
                              <CheckSquare className="w-3 h-3 mr-1" />
                              复核人：{route.gapReviewInfo!.reviewedBy}
                            </span>
                          )}
                        </div>
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
                          {route.status === 'normal' || route.status === 'supplement_pending_recalc' || route.status === 'reviewed_resolved' ? (
                            <button
                              onClick={() => handleDelete(route.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除行（可能导致断档）"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-gray-300 cursor-not-allowed"
                              title="待复核状态不允许删除"
                            >
                              <XCircle className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2 flex items-center">
          <MessageSquare className="w-4 h-4 mr-2" />
          吴老师与教研组交接说明
        </h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>人工删除行后，系统检测到编号断档，不自动修正编号，由上方黄色列表"教研组复核"按钮处理</li>
          <li>复核时必须填写：原始断档情况、处理方式说明（补录/重排编号/接受）、下一步责任人</li>
          <li>复核完成后，相邻记录状态变为"断档已复核"，变更历史保留完整的处理证据</li>
          <li>所有导出、页面展示、接口读取均来自同一份 picking_route + gap_record 数据源</li>
          <li>导出CSV末尾附带断档汇总，教研组可直接用于核对</li>
        </ul>
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
                <p>补录后系统将自动设置：</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>原始行号标记为"补录"(值为-1)</li>
                  <li>当前编号为现有最大编号+1</li>
                  <li>状态为"补录待重算"</li>
                  <li>需要点击"补录后重算"按钮重新计算拣货路线参数</li>
                </ul>
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

      {showReviewModal && selectedGap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReviewModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <h3 className="font-serif text-xl font-bold text-gray-900 mb-2">教研组复核编号断档</h3>
            <p className="text-sm text-gray-500 mb-4">
              请认真核对断档情况，填写处理说明，所有信息将记入变更历史，保留原始证据
            </p>

            <div className="bg-warning-50 border-2 border-warning-300 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-warning-800 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                断档原始情况（不能修改，作为证据保留）
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">前编号：</span>
                  <span className="font-mono font-medium text-warning-900 ml-1">{selectedGap.beforeLineNo}</span>
                </div>
                <div>
                  <span className="text-gray-500">后编号：</span>
                  <span className="font-mono font-medium text-warning-900 ml-1">{selectedGap.afterLineNo}</span>
                </div>
                <div>
                  <span className="text-gray-500">缺失条数：</span>
                  <span className="font-bold text-red-600 ml-1">{selectedGap.missingCount}</span>
                </div>
                <div className="col-span-3">
                  <span className="text-gray-500">检测时间：</span>
                  <span className="font-mono text-warning-900 ml-1">
                    {dayjs(selectedGap.detectedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理方式 <span className="text-red-500">*</span>
                </label>
                <select
                  value={reviewForm.resolutionType}
                  onChange={(e) => setReviewForm({ ...reviewForm, resolutionType: e.target.value as GapResolutionType })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  <option value="accept_gap">接受断档，不修正（保留现状）</option>
                  <option value="supplement_fill">补录填充断档（之后点"补录一行"）</option>
                  <option value="renumber">后续人工重新编排编号</option>
                  <option value="other">其他方式（见说明）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  复核说明 / 处理原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewForm.resolutionRemark}
                  onChange={(e) => setReviewForm({ ...reviewForm, resolutionRemark: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  rows={3}
                  placeholder="说明断档产生原因、处理决定的依据、具体处理方式..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  下一步责任人 / 移交教研组哪位老师
                </label>
                <input
                  type="text"
                  value={reviewForm.nextHandler}
                  onChange={(e) => setReviewForm({ ...reviewForm, nextHandler: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="如：张老师（负责补录）、李老师（负责重排编号）、留空表示本次已处理完毕"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded p-3 text-sm text-indigo-700">
                <p className="font-medium mb-1">复核完成后将自动：</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>断档记录状态从"待复核" → "已复核"</li>
                  <li>相邻两条记录标记为"断档已复核"，状态中可见复核人</li>
                  <li>本次复核的全部信息记入变更历史（原始断档→处理方式→说明→下一步）</li>
                  <li>只有全部断档都完成复核，才能发布参数版本</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消，保留待复核
              </button>
              <button
                onClick={handleSubmitReview}
                className="px-4 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors inline-flex items-center"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                确认复核，提交处理记录
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
