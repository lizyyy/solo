import { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Clock,
  MessageSquare,
  Image,
  History,
  Plus,
  X,
  AlertCircle,
  Info,
  Edit3,
} from 'lucide-react';
import { useAppStore } from '../store';
import { Point, PointStatus, TabType, ConflictInfo } from '../types';
import { cn, getSourceColor, getSourceLabel, getStatusColor, getStatusLabel } from '../lib/utils';

interface CustomResolveModal {
  open: boolean;
  conflictIndex: number;
  conflict: ConflictInfo | null;
}

export function ReviewPage() {
  const { points, selectedPointId, setSelectedPointId, updatePointStatus, addRemark, resolveConflict } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [remarkText, setRemarkText] = useState('');
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [filterStatus, setFilterStatus] = useState<PointStatus | 'all'>('all');
  const [customModal, setCustomModal] = useState<CustomResolveModal>({ open: false, conflictIndex: -1, conflict: null });
  const [customValue, setCustomValue] = useState('');

  const filteredPoints = filterStatus === 'all' ? points : points.filter((p) => p.status === filterStatus);
  const selectedPoint = points.find((p) => p.id === selectedPointId);

  const handleStatusChange = (pointId: string, status: PointStatus) => {
    updatePointStatus(pointId, status);
  };

  const handleAddRemark = () => {
    if (remarkText.trim() && selectedPointId) {
      addRemark(selectedPointId, remarkText);
      setRemarkText('');
      setShowRemarkInput(false);
    }
  };

  const handleResolveConflict = (conflictIndex: number, resolution: 'use_gis' | 'use_import' | 'custom') => {
    if (!selectedPointId) return;
    if (resolution === 'custom') {
      const conflict = selectedPoint?.conflicts[conflictIndex];
      if (!conflict) return;
      setCustomValue('');
      setCustomModal({ open: true, conflictIndex, conflict });
      return;
    }
    resolveConflict(selectedPointId, conflictIndex, resolution);
  };

  const handleCustomConfirm = () => {
    if (!selectedPointId || !customValue.trim() || !customModal.conflict) return;
    resolveConflict(selectedPointId, customModal.conflictIndex, 'custom', customValue.trim());
    setCustomModal({ open: false, conflictIndex: -1, conflict: null });
    setCustomValue('');
  };

  const handleCustomCancel = () => {
    setCustomModal({ open: false, conflictIndex: -1, conflict: null });
    setCustomValue('');
  };

  const unresolvedConflicts = selectedPoint?.conflicts.filter((c) => !c.resolved) || [];

  const conflictFieldLabel: Record<string, string> = { name: '点位名称', address: '地址', category: '类别' };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6 relative">
      {customModal.open && customModal.conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                手动处理 — {conflictFieldLabel[customModal.conflict.type]}冲突
              </h3>
              <button onClick={handleCustomCancel} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              请输入人工判定后的{conflictFieldLabel[customModal.conflict.type]}，保存后将同步更新点位正文、冲突处理状态、历史记录和导出清单。
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">GIS数据</p>
                <p className="text-sm font-medium text-gray-900">{customModal.conflict.gisValue}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-xs text-purple-600 mb-1">导入数据</p>
                <p className="text-sm font-medium text-gray-900">{customModal.conflict.importValue}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                人工判定的{conflictFieldLabel[customModal.conflict.type]}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomConfirm(); }}
                placeholder={`请输入${conflictFieldLabel[customModal.conflict.type]}`}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-2">
                可参考上方 GIS 数据或导入数据，也可输入全新的值。此项不可为空。
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCustomCancel}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCustomConfirm}
                disabled={!customValue.trim()}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2',
                  customValue.trim()
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <CheckCircle className="w-4 h-4" />
                保存人工判定
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-80 flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">人工复核</h1>
          <p className="text-gray-600 text-sm">逐个审核点位信息并标记状态</p>
        </div>

        <div className="flex gap-1 mb-4">
          {(['all', 'pending', 'verified', 'onsite'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-lg transition-colors',
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {status === 'all' ? '全部' : getStatusLabel(status)}
              <span className="ml-1 opacity-70">
                ({status === 'all' ? points.length : points.filter((p) => p.status === status).length})
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {filteredPoints.map((point) => (
            <button
              key={point.id}
              onClick={() => setSelectedPointId(point.id)}
              className={cn(
                'w-full p-4 rounded-xl border text-left transition-all',
                selectedPointId === point.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{point.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{point.address}</p>
                </div>
                <span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', getStatusColor(point.status))}>
                  {getStatusLabel(point.status)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn('px-2 py-0.5 text-xs rounded-full', getSourceColor(point.source))}>
                  {getSourceLabel(point.source)}
                </span>
                <span className="text-xs text-gray-400">{point.category}</span>
                {point.conflicts.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    {point.conflicts.filter((c) => !c.resolved).length} 处冲突
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        {selectedPoint ? (
          <>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedPoint.name}</h2>
                  <p className="text-gray-600 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedPoint.address}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-3 py-1 text-sm rounded-full', getStatusColor(selectedPoint.status))}>
                    {getStatusLabel(selectedPoint.status)}
                  </span>
                  <span className={cn('px-3 py-1 text-sm rounded-full', getSourceColor(selectedPoint.source))}>
                    {getSourceLabel(selectedPoint.source)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200">
              <div className="flex gap-1 px-6">
                {(['basic', 'feedback', 'photo', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                      activeTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {tab === 'basic' && '基本信息'}
                    {tab === 'feedback' && `反馈记录 (${selectedPoint.feedbacks.length})`}
                    {tab === 'photo' && `照片 (${selectedPoint.photos.length})`}
                    {tab === 'history' && `历史记录 (${selectedPoint.history.length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  {unresolvedConflicts.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        数据冲突 ({unresolvedConflicts.length} 处待处理)
                      </h3>
                      <div className="space-y-4">
                        {selectedPoint.conflicts
                          .filter((c) => !c.resolved)
                          .map((conflict, idx) => (
                            <div key={idx} className="p-4 bg-white rounded-lg border border-amber-200">
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                {conflict.type === 'name' && '点位名称冲突'}
                                {conflict.type === 'address' && '地址信息冲突'}
                                {conflict.type === 'category' && '类别信息冲突'}
                              </p>
                              <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <p className="text-xs text-blue-600 mb-1">GIS数据</p>
                                  <p className="text-sm font-medium text-gray-900">{conflict.gisValue}</p>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-lg">
                                  <p className="text-xs text-purple-600 mb-1">导入数据</p>
                                  <p className="text-sm font-medium text-gray-900">{conflict.importValue}</p>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                {conflict.suggestion}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleResolveConflict(selectedPoint.conflicts.indexOf(conflict), 'use_gis')}
                                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                  采用GIS数据
                                </button>
                                <button
                                  onClick={() => handleResolveConflict(selectedPoint.conflicts.indexOf(conflict), 'use_import')}
                                  className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                  采用导入数据
                                </button>
                                <button
                                  onClick={() => handleResolveConflict(selectedPoint.conflicts.indexOf(conflict), 'custom')}
                                  className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                  手动处理
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {selectedPoint.conflicts.filter((c) => c.resolved).length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        冲突处理结论 ({selectedPoint.conflicts.filter((c) => c.resolved).length} 项已处理)
                      </h3>
                      <div className="space-y-2">
                        {selectedPoint.conflicts
                          .filter((c) => c.resolved)
                          .map((conflict, idx) => (
                            <div key={idx} className="p-3 bg-white rounded-lg border border-green-200">
                              <p className="text-sm">
                                <span className="font-medium text-gray-700">
                                  {conflict.type === 'name' && '点位名称：'}
                                  {conflict.type === 'address' && '地址信息：'}
                                  {conflict.type === 'category' && '类别信息：'}
                                </span>
                                <span className="text-green-700">
                                  {conflict.resolution === 'use_gis' && '采用GIS数据 → '}
                                  {conflict.resolution === 'use_import' && '采用导入数据 → '}
                                  {conflict.resolution === 'custom' && '手动处理 → '}
                                  <span className="font-semibold">{conflict.resolvedValue}</span>
                                </span>
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">类别</label>
                      <p className="text-gray-900">{selectedPoint.category || '未分类'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">坐标</label>
                      <p className="text-gray-900">
                        {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">描述与备注（各来源整合）</label>
                    <div className="p-4 bg-gray-50 rounded-lg text-gray-700 whitespace-pre-wrap">
                      {selectedPoint.description || '暂无描述'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">补充备注</label>
                      {!showRemarkInput && (
                        <button
                          onClick={() => setShowRemarkInput(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          添加备注
                        </button>
                      )}
                    </div>
                    {showRemarkInput && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <textarea
                          value={remarkText}
                          onChange={(e) => setRemarkText(e.target.value)}
                          placeholder="输入临时备注..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="flex justify-end gap-2 mt-3">
                          <button
                            onClick={() => setShowRemarkInput(false)}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleAddRemark}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            保存备注
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'feedback' && (
                <div className="space-y-4">
                  {selectedPoint.feedbacks.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">暂无反馈记录</p>
                    </div>
                  ) : (
                    selectedPoint.feedbacks.map((fb) => (
                      <div key={fb.id} className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-900 mb-2">{fb.content}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>来源: {fb.source}</span>
                          <span>{fb.createTime}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'photo' && (
                <div className="space-y-4">
                  {selectedPoint.photos.length === 0 ? (
                    <div className="text-center py-12">
                      <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">暂无照片</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {selectedPoint.photos.map((photo) => (
                        <div key={photo.id} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                          <img
                            src={photo.url}
                            alt={photo.description || '巡检照片'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {selectedPoint.history.map((record, idx) => (
                    <div key={record.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-blue-600 rounded-full" />
                        {idx < selectedPoint.history.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{record.operator}</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(record.timestamp).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {record.action === 'import' && '导入数据'}
                          {record.action === 'merge' && `归并点位`}
                          {record.action === 'status_change' &&
                            `状态变更: ${getStatusLabel(record.oldValue as any)} → ${getStatusLabel(record.newValue as any)}`}
                          {record.action === 'remark' && '添加备注'}
                          {record.action === 'update' && record.field && (
                            <>
                              {record.field === 'name' && '更新点位名称'}
                              {record.field === 'address' && '更新地址'}
                              {record.field === 'category' && '更新类别'}
                              {record.field === 'description' && '更新描述'}
                              {record.oldValue && record.newValue && `：${record.oldValue} → ${record.newValue}`}
                            </>
                          )}
                          {record.action === 'update' && !record.field && '更新信息'}
                        </p>
                        {record.remark && <p className="text-sm text-gray-500 mt-1">{record.remark}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-3">标记状态</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleStatusChange(selectedPoint.id, 'verified')}
                  className={cn(
                    'flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                    selectedPoint.status === 'verified'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <CheckCircle className="w-5 h-5" />
                  已处理
                </button>
                <button
                  onClick={() => handleStatusChange(selectedPoint.id, 'pending')}
                  className={cn(
                    'flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                    selectedPoint.status === 'pending'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <AlertTriangle className="w-5 h-5" />
                  待核实
                </button>
                <button
                  onClick={() => handleStatusChange(selectedPoint.id, 'onsite')}
                  className={cn(
                    'flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                    selectedPoint.status === 'onsite'
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <MapPin className="w-5 h-5" />
                  需要现场复看
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <ClipboardCheck className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium">选择一个点位开始复核</p>
            <p className="text-sm">点击左侧列表中的点位查看详情</p>
          </div>
        )}
      </div>
    </div>
  );
}
