import { useState } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import { MATERIAL_LABELS, COORDINATE_TYPE_LABELS, STATUS_LABELS } from '@/types';
import type { PipelineRecord, WorkflowStatus } from '@/types';
import {
  Compass,
  AlertTriangle,
  CheckCircle,
  Info,
  Save,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_TAG: Record<WorkflowStatus, string> = {
  step1: 'bg-blue-100 text-blue-800',
  step2: 'bg-yellow-100 text-yellow-800',
  step3: 'bg-purple-100 text-purple-800',
  pending_review: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function CoordinatesPage() {
  const { records, history, markCoordinateReviewed } = usePipelineStore();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mixedCount = records.filter((r) => r.isCoordinateMixed).length;
  const latlngCount = records.filter((r) => r.coordinate.type === 'latlng').length;
  const metricCount = records.filter((r) => r.coordinate.type === 'metric').length;

  const formatCoordinate = (record: PipelineRecord) => {
    const { coordinate } = record;
    if (coordinate.type === 'latlng') {
      return `纬度: ${coordinate.lat?.toFixed(6) || '—'}  经度: ${coordinate.lng?.toFixed(6) || '—'}`;
    }
    return `X: ${coordinate.metricX?.toFixed(2) || '—'}  Y: ${coordinate.metricY?.toFixed(2) || '—'}`;
  };

  const getReviewHistory = (recordId: string) => {
    return history
      .filter((h) => h.recordId === recordId && (h.action === 'review_coordinate'))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const handleStartReview = (recordId: string) => {
    setReviewingId(recordId);
    if (!reviewNotes[recordId]) {
      setReviewNotes((prev) => ({ ...prev, [recordId]: '' }));
    }
  };

  const handleSubmitReview = (recordId: string) => {
    const note = reviewNotes[recordId]?.trim();
    if (!note) {
      alert('请填写巡检组复核说明（处理原因）');
      return;
    }
    markCoordinateReviewed(recordId, note);
    setReviewingId(null);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-primary-800 flex items-center gap-2">
          <Compass className="text-industrial-orange" />
          坐标复核
        </h1>
        <p className="text-sm text-industrial-gray mt-1">
          经纬度与米制坐标混合检测 · 留待巡检组复核 · 保留原始说法+改后值+处理原因+下一步
        </p>
      </div>

      <div className="card p-4 bg-orange-50 border-orange-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <p className="font-display font-medium text-orange-800">
              业务规则：坐标混合 <strong>不自动归为正常</strong>
            </p>
            <p className="text-sm text-orange-700">
              当系统同时存在经纬度坐标和米制坐标时，所有相关记录会被标记为「坐标混合」并将状态设为
              <strong>待巡检组复核</strong>。
              必须由巡检组人工确认：填写处理原因 → 点击确认复核 → 系统才将状态推回工作流。
              复核信息（原始坐标类型、改后状态、处理原因、下一步）完整保留在历史追溯中。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-display">经纬度记录</div>
          <div className="text-3xl font-bold font-mono-data text-blue-600 mt-1">{latlngCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-display">米制坐标记录</div>
          <div className="text-3xl font-bold font-mono-data text-purple-600 mt-1">{metricCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-display">坐标混合待复核</div>
          <div className={cn(
            'text-3xl font-bold font-mono-data mt-1',
            mixedCount > 0 ? 'text-industrial-orange animate-pulse' : 'text-gray-300'
          )}>
            {mixedCount}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-display">坐标类型统一</div>
          <div className={cn(
            'text-3xl font-bold font-mono-data mt-1',
            (latlngCount === 0 || metricCount === 0) && records.length > 0 ? 'text-industrial-green' : 'text-gray-300'
          )}>
            {(latlngCount === 0 || metricCount === 0) && records.length > 0 ? '✓' : '—'}
          </div>
        </div>
      </div>

      {mixedCount > 0 && (
        <div className="card overflow-hidden border-industrial-orange">
          <div className="px-4 py-3 border-b border-orange-200 bg-orange-50">
            <h2 className="font-display font-semibold text-orange-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              待巡检组复核 ({mixedCount})
            </h2>
            <p className="text-xs text-orange-600 mt-0.5">
              点击「展开详情」查看原始坐标 → 填写复核说明 → 点击「确认已复核」解锁后续流程
            </p>
          </div>
          <div className="divide-y divide-orange-100">
            {records.filter((r) => r.isCoordinateMixed).map((record) => {
              const isReviewing = reviewingId === record.id;
              const isExpanded = expandedId === record.id;
              const reviewHistory = getReviewHistory(record.id);

              return (
                <div key={record.id} className={cn(
                  'bg-orange-50/30 animate-pulse-orange'
                )}>
                  <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="font-mono-data text-lg text-primary-800">
                        {record.photoNumber}
                      </span>
                      <span className={cn(
                        'status-tag',
                        record.materialType === 'normal' && 'bg-blue-50 text-blue-700',
                        record.materialType === 'wrong_caliber' && 'bg-red-50 text-red-700',
                        record.materialType === 'supplementary' && 'bg-amber-50 text-amber-700',
                      )}>
                        {MATERIAL_LABELS[record.materialType]}
                      </span>
                      {record.cadLayer && (
                        <span className="font-mono-data text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          CAD: {record.cadLayer}
                        </span>
                      )}
                      <span className={cn('status-tag', STATUS_TAG[record.status])}>
                        {STATUS_LABELS[record.status]}
                      </span>
                      <span className="font-mono-data text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                        原始坐标: {COORDINATE_TYPE_LABELS[record.coordinate.type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        className="text-xs text-gray-600 hover:text-primary-700 inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? '收起详情' : '展开详情'}
                      </button>
                      {!isReviewing && (
                        <button
                          onClick={() => handleStartReview(record.id)}
                          className="btn-warning inline-flex items-center gap-1.5 text-sm"
                        >
                          <Compass className="w-4 h-4" />
                          填写复核说明
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 p-4 rounded">
                          <div className="text-xs text-gray-500 font-display mb-2">原始坐标值（系统检测时保留）</div>
                          <div className="font-mono-data text-sm text-gray-800">
                            {formatCoordinate(record)}
                          </div>
                        </div>
                        <div className="bg-white border border-orange-300 p-4 rounded">
                          <div className="text-xs text-orange-600 font-display mb-2">复核后状态变化</div>
                          <div className="text-sm text-gray-800 flex items-center gap-2">
                            <span>
                              isCoordinateMixed:
                              <span className="line-through text-red-600 font-mono-data"> true</span>
                              <ArrowRight className="w-3 h-3 inline mx-1 text-gray-400" />
                              <span className="text-green-600 font-mono-data"> false</span>
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 mt-2 font-display">
                            状态将从 {STATUS_LABELS[record.status]}
                            {record.cadLayer ? (
                              record.siteInstruction
                                ? ' → 第三步：待更新说明（已填）'
                                : ' → 第二步：已补录CAD（待填说明）'
                            ) : ' → 第一步：已导入照片'}
                          </div>
                        </div>
                      </div>

                      {reviewHistory.length > 0 && (
                        <div className="bg-white border border-gray-200 p-4 rounded">
                          <div className="text-xs text-gray-500 font-display mb-2">
                            历史复核记录 ({reviewHistory.length})
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {reviewHistory.map((h, i) => (
                              <div key={i} className="bg-gray-50 p-2 rounded border border-gray-200">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1 font-mono-data">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" /> {h.operator}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(h.timestamp).toLocaleString('zh-CN')}
                                  </span>
                                </div>
                                {h.evidence && (
                                  <div className="text-xs text-gray-700 mt-1">{h.evidence}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isReviewing && (
                        <div className="bg-industrial-orange/5 border-2 border-industrial-orange p-4 rounded">
                          <div className="text-sm font-display font-semibold text-orange-800 mb-2">
                            巡检组复核说明（必填）
                          </div>
                          <div className="text-xs text-orange-700 mb-2">
                            请说明：本次坐标混合是否确认可通过？原始坐标是否准确？统一采用哪种坐标基准？下一步由谁处理？
                          </div>
                          <textarea
                            className="input-field w-full text-sm min-h-[80px]"
                            placeholder="例如：&#10;处理原因：经核对，本记录坐标为经纬度（31.2304, 121.4737），系统另有米制坐标记录系另一区域录入，本记录可通过复核。&#10;下一步：由培训教官老梁继续填写现场说明，状态推回Step2/Step3工作流。"
                            value={reviewNotes[record.id] || ''}
                            onChange={(e) => setReviewNotes((prev) => ({
                              ...prev,
                              [record.id]: e.target.value,
                            }))}
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleSubmitReview(record.id)}
                              className="btn-success inline-flex items-center gap-1.5 text-sm"
                              disabled={!reviewNotes[record.id]?.trim()}
                            >
                              <Save className="w-4 h-4" />
                              确认已复核（推回工作流）
                            </button>
                            <button
                              onClick={() => setReviewingId(null)}
                              className="btn-outline text-sm"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isReviewing && !isExpanded && (
                    <div className="px-5 pb-4">
                      <textarea
                        className="input-field w-full text-sm min-h-[60px]"
                        placeholder="巡检组复核说明（必填）：处理原因 + 下一步..."
                        value={reviewNotes[record.id] || ''}
                        onChange={(e) => setReviewNotes((prev) => ({
                          ...prev,
                          [record.id]: e.target.value,
                        }))}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleSubmitReview(record.id)}
                          className="btn-success inline-flex items-center gap-1.5 text-sm"
                          disabled={!reviewNotes[record.id]?.trim()}
                        >
                          <Save className="w-4 h-4" />
                          确认已复核
                        </button>
                        <button
                          onClick={() => setReviewingId(null)}
                          className="btn-outline text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-display font-semibold text-gray-800">
            全部坐标记录 ({records.length})
          </h2>
          <span className="text-xs text-industrial-gray font-mono-data">
            经纬度 {latlngCount} + 米制 {metricCount} = {latlngCount + metricCount}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-display font-medium text-gray-600">照片编号</th>
              <th className="text-left px-4 py-2 font-display font-medium text-gray-600">材料类型</th>
              <th className="text-left px-4 py-2 font-display font-medium text-gray-600">坐标类型</th>
              <th className="text-left px-4 py-2 font-display font-medium text-gray-600">坐标值</th>
              <th className="text-left px-4 py-2 font-display font-medium text-gray-600">状态</th>
              <th className="text-left px-4 py-2 font-display font-medium text-gray-600">坐标混合</th>
              <th className="text-left px-4 py-2 font-display font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  暂无记录，请前往数据导入录入
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className={cn(
                    'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                    record.isCoordinateMixed && 'bg-orange-50'
                  )}
                >
                  <td className="px-4 py-3 font-mono-data">{record.photoNumber}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'status-tag',
                      record.materialType === 'normal' && 'bg-blue-50 text-blue-700',
                      record.materialType === 'wrong_caliber' && 'bg-red-50 text-red-700',
                      record.materialType === 'supplementary' && 'bg-amber-50 text-amber-700',
                    )}>
                      {MATERIAL_LABELS[record.materialType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono-data">
                    {COORDINATE_TYPE_LABELS[record.coordinate.type]}
                  </td>
                  <td className="px-4 py-3 font-mono-data text-xs">{formatCoordinate(record)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('status-tag', STATUS_TAG[record.status])}>
                      {STATUS_LABELS[record.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {record.isCoordinateMixed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" />待复核
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" />正常
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.isCoordinateMixed && (
                      <button
                        onClick={() => handleStartReview(record.id)}
                        className="btn-warning text-xs py-1 px-2"
                      >
                        填写复核
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
