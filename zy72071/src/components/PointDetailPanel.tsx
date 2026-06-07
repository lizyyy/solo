import { X, Clock, User, AlertTriangle, ImageOff, MapPin, Link2 } from 'lucide-react';
import type { Point, JudgmentTrace } from '../types';
import { useProjectStore } from '../store/projectStore';

const anomalyLabels: Record<string, { label: string; color: string }> = {
  coordinate_offset: { label: '坐标偏移', color: 'bg-yellow-500' },
  duplicate_name: { label: '设备重名', color: 'bg-purple-500' },
  missing_photo: { label: '缺少照片', color: 'bg-red-500' },
  cross_floor: { label: '跨楼层关联', color: 'bg-orange-500' },
};

const actionLabels: Record<string, { label: string; icon: string }> = {
  import: { label: '数据导入', icon: '📥' },
  auto_detect: { label: '自动检测', icon: '🔍' },
  manual_judge: { label: '人工判断', icon: '✋' },
  supplement_note: { label: '补充备注', icon: '📝' },
  import_success: { label: '导入成功', icon: '✅' },
  import_fail: { label: '导入失败', icon: '❌' },
  export: { label: '导出方案', icon: '📤' },
  review_verify: { label: '复核校验', icon: '✔️' },
  handover: { label: '交接报告', icon: '📋' },
};

interface PointDetailPanelProps {
  point: Point;
  traces: JudgmentTrace[];
}

export function PointDetailPanel({ point, traces }: PointDetailPanelProps) {
  const { selectPoint } = useProjectStore();
  const pointTraces = traces.filter((t) => t.pointId === point.id);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="font-bold text-lg">{point.name}</h3>
        <button
          onClick={() => selectPoint(null)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-slate-400">设备编号</div>
          <div className="font-mono text-sm bg-slate-800 px-3 py-2 rounded">
            {point.deviceId}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-slate-400">楼层</div>
            <div className="font-medium">{point.floor}F</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-400">照片</div>
            <div className="flex items-center gap-2">
              {point.hasPhoto ? (
                <span className="text-green-400">✓ 有照片</span>
              ) : (
                <span className="text-red-400 flex items-center gap-1">
                  <ImageOff size={14} /> 无照片
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <MapPin size={14} /> 空间坐标
          </div>
          <div className="font-mono text-xs bg-slate-800 px-3 py-2 rounded">
            X: {point.position.x.toFixed(2)} | Y: {point.position.y.toFixed(2)} | Z:{' '}
            {point.position.z.toFixed(2)}
          </div>
        </div>

        {point.anomalies.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400" /> 异常标记
            </div>
            <div className="space-y-2">
              {point.anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className="bg-slate-800 rounded p-3 border-l-4 border-yellow-500"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`${anomalyLabels[anomaly.type]?.color || 'bg-gray-500'} text-white text-xs px-2 py-0.5 rounded`}
                    >
                      {anomalyLabels[anomaly.type]?.label || anomaly.type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{anomaly.description}</p>
                  {anomaly.relatedPointId && (
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Link2 size={12} /> 关联点位: {anomaly.relatedPointId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm text-slate-400">原始数据备注</div>
          <div className="bg-slate-800 rounded p-3 text-sm">
            <div className="text-xs text-slate-500 mb-1">
              来源: {String(point.originalData.source || '未知')}
            </div>
            {point.originalData.remark && (
              <div className="text-slate-300 italic">
                "{String(point.originalData.remark)}"
              </div>
            )}
          </div>
        </div>

        {pointTraces.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <Clock size={14} /> 判断轨迹
            </div>
            <div className="relative">
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-700" />
              <div className="space-y-4">
                {pointTraces
                  .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                  .map((trace) => (
                    <div key={trace.id} className="relative pl-8">
                      <div className="absolute left-1.5 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-500" />
                      <div className="bg-slate-800 rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium flex items-center gap-2">
                            <span>{actionLabels[trace.action]?.icon || '•'}</span>
                            {actionLabels[trace.action]?.label || trace.action}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatTime(trace.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{trace.remark}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                          <User size={12} /> {trace.operator}
                        </div>
                        {trace.diff && (
                          <div className="mt-2 text-xs bg-slate-700 px-2 py-1 rounded">
                            <span className="text-slate-400">差异: </span>
                            <span className="text-yellow-300">{trace.diff}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {point.reviewNote && (
          <div className="space-y-2">
            <div className="text-sm text-slate-400">评审结论</div>
            <div className="bg-primary-900/30 border border-primary-700 rounded p-3 text-sm text-primary-200">
              {point.reviewNote}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
