import { usePipelineStore } from '@/store/pipelineStore';
import { MATERIAL_LABELS, COORDINATE_TYPE_LABELS, STATUS_LABELS } from '@/types';
import { Compass, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelineRecord, WorkflowStatus } from '@/types';

const STATUS_TAG: Record<WorkflowStatus, string> = {
  step1: 'bg-blue-100 text-blue-800',
  step2: 'bg-yellow-100 text-yellow-800',
  step3: 'bg-purple-100 text-purple-800',
  pending_review: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function CoordinatesPage() {
  const { records, markCoordinateReviewed } = usePipelineStore();

  const mixedCount = records.filter((r) => r.isCoordinateMixed).length;
  const latlngCount = records.filter((r) => r.coordinate.type === 'latlng').length;
  const metricCount = records.filter((r) => r.coordinate.type === 'metric').length;

  const formatCoordinate = (record: PipelineRecord) => {
    const { coordinate } = record;
    if (coordinate.type === 'latlng') {
      return `${coordinate.lat?.toFixed(6) || '—'}, ${coordinate.lng?.toFixed(6) || '—'}`;
    }
    return `X: ${coordinate.metricX?.toFixed(2) || '—'}, Y: ${coordinate.metricY?.toFixed(2) || '—'}`;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-primary-800 flex items-center gap-2">
          <Compass className="text-industrial-orange" />
          坐标复核
        </h1>
        <p className="text-sm text-industrial-gray mt-1">
          经纬度与米制坐标混合检测，留待巡检组复核，不自动归为正常
        </p>
      </div>

      <div className="card p-4 bg-orange-50 border-orange-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-display font-medium text-orange-800">重要提示</p>
            <p className="text-sm text-orange-700">
              当系统同时存在经纬度坐标和米制坐标时，所有相关记录将被标记为坐标混合。
              此类记录<strong>不会自动归为正常</strong>，必须由巡检组人工复核确认后才能继续流程。
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

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-display font-semibold text-gray-800">坐标记录列表</h2>
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
                  暂无记录
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className={cn(
                    'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                    record.isCoordinateMixed && 'bg-orange-50 animate-pulse-orange'
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
                        onClick={() => markCoordinateReviewed(record.id)}
                        className="btn-warning text-xs py-1 px-2"
                      >
                        巡检组已复核
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
