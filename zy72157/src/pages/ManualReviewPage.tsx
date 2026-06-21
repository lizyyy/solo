import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, ChevronRight, MessageSquare, History, MapPin, Edit3, Save, X, FileText, Camera, StickyNote } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { MealPoint, PointType, ManualResolveInput } from '../types';

export function ManualReviewPage() {
  const { points, confirmPoint, rejectPoint, addNoteToPoint, setCurrentStep, manuallyResolvePoint } = useApp();
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({});
  const [showManualPanel, setShowManualPanel] = useState<Record<string, boolean>>({});
  const [manualInput, setManualInput] = useState<Record<string, ManualResolveInput & { operationNote: string }>>({});

  const pendingPoints = points.filter((p) => p.status === 'pending' || p.status === 'merged');
  const confirmedPoints = points.filter((p) => p.status === 'confirmed');
  const rejectedPoints = points.filter((p) => p.status === 'rejected');

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      review: '需人工确认',
      legacy: '旧口径数据',
      boundary: '边界点位',
      empty: '空值记录',
      duplicate: '重复项',
      smooth: '顺利记录',
    };
    return labels[type] || type;
  };

  const typeOptions: { value: PointType; label: string }[] = [
    { value: 'smooth', label: '顺利记录' },
    { value: 'review', label: '需人工确认' },
    { value: 'legacy', label: '旧口径数据' },
    { value: 'boundary', label: '边界点位' },
    { value: 'duplicate', label: '重复项' },
    { value: 'empty', label: '空值记录' },
  ];

  const initManualInput = (point: MealPoint) => {
    if (!manualInput[point.id]) {
      setManualInput((prev) => ({
        ...prev,
        [point.id]: {
          name: point.name,
          address: point.address,
          type: point.type,
          zhoujieNote: point.zhoujieNote || '',
          feedback: point.feedback || '',
          photoNotes: point.photoNotes || '',
          operationNote: '',
        },
      }));
    }
  };

  const handleConfirm = (pointId: string) => {
    confirmPoint(pointId, noteInput);
    setNoteInput('');
    setExpandedPoint(null);
  };

  const handleReject = (pointId: string) => {
    const reason = rejectReason[pointId] || '点位作废';
    rejectPoint(pointId, reason);
    setShowRejectInput((prev) => ({ ...prev, [pointId]: false }));
    setRejectReason((prev) => ({ ...prev, [pointId]: '' }));
    setExpandedPoint(null);
  };

  const handleAddNote = (pointId: string) => {
    if (noteInput.trim()) {
      addNoteToPoint(pointId, noteInput);
      setNoteInput('');
    }
  };

  const handleSaveManual = (point: MealPoint) => {
    const input = manualInput[point.id];
    if (!input) return;
    manuallyResolvePoint(point.id, {
      name: input.name,
      address: input.address,
      type: input.type,
      zhoujieNote: input.zhoujieNote,
      feedback: input.feedback,
      photoNotes: input.photoNotes,
      operationNote: input.operationNote,
    });
    setShowManualPanel((prev) => ({ ...prev, [point.id]: false }));
    setExpandedPoint(null);
  };

  const allReviewed = pendingPoints.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-700">人工复核</h1>
          <p className="mt-1 text-sm text-gray-500">逐一审定点位，手动处理名称/地址/类别冲突，沉淀周姐备注与反馈</p>
        </div>
        {allReviewed && points.length > 0 && (
          <button
            onClick={() => setCurrentStep('export')}
            className="inline-flex items-center px-4 py-2 bg-warm-500 text-white rounded-lg hover:bg-warm-600 transition-colors shadow-md hover:shadow-lg"
          >
            前往公示导出
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待复核</p>
              <p className="text-2xl font-bold text-amber-600">{pendingPoints.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已确认</p>
              <p className="text-2xl font-bold text-green-600">{confirmedPoints.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已作废</p>
              <p className="text-2xl font-bold text-red-600">{rejectedPoints.length}</p>
            </div>
          </div>
        </div>
      </div>

      {pendingPoints.length > 0 && (
        <div className="space-y-4">
          {['review', 'legacy', 'boundary', 'empty', 'duplicate', 'smooth'].map((type) => {
            const typePoints = pendingPoints.filter((p) => p.type === type);
            if (typePoints.length === 0) return null;

            return (
              <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className={`px-6 py-4 border-b ${
                  type === 'review' ? 'bg-amber-50 border-amber-200' :
                  type === 'legacy' ? 'bg-slate-50 border-slate-200' :
                  type === 'boundary' ? 'bg-orange-50 border-orange-200' :
                  type === 'empty' ? 'bg-rose-50 border-rose-200' :
                  type === 'duplicate' ? 'bg-purple-50 border-purple-200' :
                  'bg-emerald-50 border-emerald-200'
                }`}>
                  <h3 className={`font-semibold flex items-center ${
                    type === 'review' ? 'text-amber-800' :
                    type === 'legacy' ? 'text-slate-800' :
                    type === 'boundary' ? 'text-orange-800' :
                    type === 'empty' ? 'text-rose-800' :
                    type === 'duplicate' ? 'text-purple-800' :
                    'text-emerald-800'
                  }`}>
                    {type === 'smooth' ? <CheckCircle className="w-5 h-5 mr-2" /> : <Clock className="w-5 h-5 mr-2" />}
                    {getTypeLabel(type)} ({typePoints.length} 条)
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {typePoints.map((point) => (
                    <ReviewPointCard
                      key={point.id}
                      point={point}
                      isExpanded={expandedPoint === point.id}
                      onToggleExpand={() => {
                        if (expandedPoint !== point.id) initManualInput(point);
                        setExpandedPoint(expandedPoint === point.id ? null : point.id);
                      }}
                      onConfirm={() => handleConfirm(point.id)}
                      onReject={() => handleReject(point.id)}
                      showRejectInput={showRejectInput[point.id] || false}
                      setShowRejectInput={(show) =>
                        setShowRejectInput((prev) => ({ ...prev, [point.id]: show }))
                      }
                      rejectReason={rejectReason[point.id] || ''}
                      setRejectReason={(value) =>
                        setRejectReason((prev) => ({ ...prev, [point.id]: value }))
                      }
                      noteInput={noteInput}
                      setNoteInput={setNoteInput}
                      onAddNote={() => handleAddNote(point.id)}
                      showManualPanel={showManualPanel[point.id] || false}
                      setShowManualPanel={(show) => {
                        if (show) initManualInput(point);
                        setShowManualPanel((prev) => ({ ...prev, [point.id]: show }));
                      }}
                      manualInput={manualInput[point.id] || { name: point.name, address: point.address, type: point.type, zhoujieNote: '', feedback: '', photoNotes: '', operationNote: '' }}
                      setManualInputField={(field, value) =>
                        setManualInput((prev) => ({
                          ...prev,
                          [point.id]: { ...(prev[point.id] || { name: point.name, address: point.address, type: point.type, zhoujieNote: '', feedback: '', photoNotes: '', operationNote: '' }), [field]: value },
                        }))
                      }
                      onSaveManual={() => handleSaveManual(point)}
                      typeOptions={typeOptions}
                      getTypeLabel={getTypeLabel}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allReviewed && points.length > 0 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-8 text-white text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl font-bold mb-2">复核完成！</h2>
          <p className="text-green-100 mb-6">所有点位已完成人工复核，可以进行公示导出</p>
          <button
            onClick={() => setCurrentStep('export')}
            className="inline-flex items-center px-6 py-3 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors shadow-lg"
          >
            前往公示导出
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
        </div>
      )}

      {points.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">暂无数据，请先导入点位数据</p>
          <button
            onClick={() => setCurrentStep('import')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            前往数据导入
          </button>
        </div>
      )}
    </div>
  );
}

interface ReviewPointCardProps {
  point: MealPoint;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onConfirm: () => void;
  onReject: () => void;
  showRejectInput: boolean;
  setShowRejectInput: (show: boolean) => void;
  rejectReason: string;
  setRejectReason: (value: string) => void;
  noteInput: string;
  setNoteInput: (value: string) => void;
  onAddNote: () => void;
  showManualPanel: boolean;
  setShowManualPanel: (show: boolean) => void;
  manualInput: ManualResolveInput & { operationNote: string };
  setManualInputField: (field: string, value: any) => void;
  onSaveManual: () => void;
  typeOptions: { value: PointType; label: string }[];
  getTypeLabel: (t: string) => string;
}

function ReviewPointCard({
  point,
  isExpanded,
  onToggleExpand,
  onConfirm,
  onReject,
  showRejectInput,
  setShowRejectInput,
  rejectReason,
  setRejectReason,
  noteInput,
  setNoteInput,
  onAddNote,
  showManualPanel,
  setShowManualPanel,
  manualInput,
  setManualInputField,
  onSaveManual,
  typeOptions,
  getTypeLabel,
}: ReviewPointCardProps) {
  const hasChanges =
    manualInput.name !== point.name ||
    manualInput.address !== point.address ||
    manualInput.type !== point.type ||
    (manualInput.zhoujieNote && manualInput.zhoujieNote !== (point.zhoujieNote || '')) ||
    (manualInput.feedback && manualInput.feedback !== (point.feedback || '')) ||
    (manualInput.photoNotes && manualInput.photoNotes !== (point.photoNotes || ''));

  return (
    <div className="hover:bg-gray-50 transition-colors">
      <div
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-primary-600" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">
              {point.name || '(未命名点位)'}
            </h4>
            <p className="text-sm text-gray-500 truncate">{point.address}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <StatusBadge type="source" value={point.source} />
            <StatusBadge type="pointType" value={point.type} />
            {(point.manualResolveHistory && point.manualResolveHistory.length > 0) && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">
                <Edit3 className="w-3 h-3 mr-1" />人工处理
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-4 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-gray-700">点位信息</h5>
              <div className="text-sm space-y-1">
                <p><span className="text-gray-500">名称：</span>{point.name || '(空)'}</p>
                <p><span className="text-gray-500">地址：</span>{point.address}</p>
                <p><span className="text-gray-500">坐标：</span>{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
                <p><span className="text-gray-500">类型：</span>{getTypeLabel(point.type)}</p>
                {point.zhoujieNote && (
                  <p className="text-amber-700"><StickyNote className="w-3 h-3 inline mr-1" /><span className="text-gray-500">周姐备注：</span>{point.zhoujieNote}</p>
                )}
                {point.feedback && (
                  <p className="text-blue-700"><MessageSquare className="w-3 h-3 inline mr-1" /><span className="text-gray-500">反馈：</span>{point.feedback}</p>
                )}
                {point.photoNotes && (
                  <p className="text-green-700"><Camera className="w-3 h-3 inline mr-1" /><span className="text-gray-500">照片：</span>{point.photoNotes}</p>
                )}
                {point.notes && (
                  <p><span className="text-gray-500">备注：</span>{point.notes}</p>
                )}
                <p><span className="text-gray-500">来源文件：</span>{point.fileName || '未知'}</p>
                <p><span className="text-gray-500">原始行号：</span>第 {point.sourceRowNumber} 行</p>
              </div>
              {point.originalValues && Object.keys(point.originalValues).length > 0 && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs space-y-1">
                  <p className="font-medium text-indigo-800 mb-1 flex items-center"><Edit3 className="w-3 h-3 mr-1" />人工处理历史（原值 → 现值）</p>
                  {point.originalValues.name && (
                    <p className="text-indigo-700">名称：<span className="line-through text-gray-400">{point.originalValues.name}</span> <span className="mx-1">→</span> <span className="font-medium">{point.name}</span></p>
                  )}
                  {point.originalValues.address && (
                    <p className="text-indigo-700">地址：<span className="line-through text-gray-400">{point.originalValues.address}</span> <span className="mx-1">→</span> <span className="font-medium">{point.address}</span></p>
                  )}
                  {point.originalValues.type && (
                    <p className="text-indigo-700">类型：<span className="line-through text-gray-400">{getTypeLabel(point.originalValues.type)}</span> <span className="mx-1">→</span> <span className="font-medium">{getTypeLabel(point.type)}</span></p>
                  )}
                </div>
              )}
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <History className="w-4 h-4 mr-1" />
                判断过程留痕 ({point.auditTrail.length} 条)
              </h5>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {point.auditTrail.map((record) => (
                  <div key={record.id} className={`text-xs p-2 rounded ${
                    record.action === 'manualResolve' ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        {record.operator} · {record.action === 'manualResolve' ? '✋手动处理' : record.action === 'confirm' ? '✅确认' : record.action === 'reject' ? '❌作废' : record.action === 'note' ? '📝备注' : record.action}
                      </span>
                      <span className="text-gray-400">
                        {new Date(record.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">{record.remark}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {Object.keys(point.sourceRow).length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">原始行数据（{point.fileName} 第{point.sourceRowNumber}行）</h5>
              <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                <table className="text-xs w-full">
                  <tbody>
                    {Object.entries(point.sourceRow).map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-200 last:border-0">
                        <td className="py-1.5 pr-4 text-gray-500 font-medium whitespace-nowrap w-24">{key}</td>
                        <td className="py-1.5 text-gray-800">{value || <span className="text-gray-300">(空)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showManualPanel ? (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-indigo-800 flex items-center">
                  <Edit3 className="w-4 h-4 mr-2" />手动处理：录入人工判定值（将回写到点位正文并留下历史）
                </h5>
                {hasChanges && (
                  <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">检测到修改</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">点位名称 <span className="text-indigo-600">(可编辑)</span></label>
                  <input
                    type="text"
                    value={manualInput.name || ''}
                    onChange={(e) => setManualInputField('name', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      manualInput.name !== point.name ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'
                    }`}
                  />
                  {manualInput.name !== point.name && (
                    <p className="text-xs text-amber-600 mt-1">原值：{point.name || '(空)'}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">详细地址 <span className="text-indigo-600">(可编辑)</span></label>
                  <input
                    type="text"
                    value={manualInput.address || ''}
                    onChange={(e) => setManualInputField('address', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      manualInput.address !== point.address ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'
                    }`}
                  />
                  {manualInput.address !== point.address && (
                    <p className="text-xs text-amber-600 mt-1">原值：{point.address}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">点位类型 <span className="text-indigo-600">(可编辑)</span></label>
                  <select
                    value={manualInput.type || point.type}
                    onChange={(e) => setManualInputField('type', e.target.value as PointType)}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      manualInput.type !== point.type ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {manualInput.type !== point.type && (
                    <p className="text-xs text-amber-600 mt-1">原类型：{getTypeLabel(point.type)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-amber-700 mb-1 flex items-center">
                    <StickyNote className="w-3 h-3 mr-1" />周姐备注
                  </label>
                  <textarea
                    value={manualInput.zhoujieNote || ''}
                    onChange={(e) => setManualInputField('zhoujieNote', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="例：此点位已列入整改计划，预计下月完成"
                    rows={2}
                    className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1 flex items-center">
                    <MessageSquare className="w-3 h-3 mr-1" />居民反馈
                  </label>
                  <textarea
                    value={manualInput.feedback || ''}
                    onChange={(e) => setManualInputField('feedback', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="居民意见、诉求、问题描述"
                    rows={2}
                    className="w-full px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-green-700 mb-1 flex items-center">
                    <Camera className="w-3 h-3 mr-1" />巡检照片说明
                  </label>
                  <textarea
                    value={manualInput.photoNotes || ''}
                    onChange={(e) => setManualInputField('photoNotes', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="现场拍摄情况、环境、门头照等说明"
                    rows={2}
                    className="w-full px-3 py-2 border border-green-300 bg-green-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">处理说明（可选）</label>
                <input
                  type="text"
                  value={manualInput.operationNote || ''}
                  onChange={(e) => setManualInputField('operationNote', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="本次手动处理的决策依据、参考材料等，会写入审计留痕"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowManualPanel(false); }}
                  className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  <X className="w-4 h-4 mr-2" />取消
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onSaveManual(); }}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm shadow-md"
                >
                  <Save className="w-4 h-4 mr-2" />保存并确认（回写点位正文 + 留痕）
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                placeholder="添加备注..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); onAddNote(); }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {showRejectInput ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder="输入作废原因..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); onReject(); }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  确认作废
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRejectInput(false); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRejectInput(true); }}
                  className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  点位作废
                </button>
                {!showManualPanel && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowManualPanel(true); }}
                    className="inline-flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    手动处理
                  </button>
                )}
                {!showManualPanel && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    确认通过
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
