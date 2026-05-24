
import { X, Camera } from 'lucide-react';
import { CrackLevel, RecheckStatus } from '../../types';
import { useInspectionStore } from '../../store/useInspectionStore';
import { cn } from '../../lib/utils';

const levelLabels: Record<CrackLevel, string> = {
  [CrackLevel.LIGHT]: '轻微',
  [CrackLevel.MODERATE]: '中等',
  [CrackLevel.SEVERE]: '严重',
};

const levelColors: Record<CrackLevel, string> = {
  [CrackLevel.LIGHT]: 'bg-green-500',
  [CrackLevel.MODERATE]: 'bg-orange-500',
  [CrackLevel.SEVERE]: 'bg-red-500',
};

const statusLabels: Record<RecheckStatus, string> = {
  [RecheckStatus.PENDING]: '待复检',
  [RecheckStatus.VERIFIED]: '已确认',
  [RecheckStatus.RESOLVED]: '已修复',
};

const statusColors: Record<RecheckStatus, string> = {
  [RecheckStatus.PENDING]: 'bg-yellow-500',
  [RecheckStatus.VERIFIED]: 'bg-cyan-500',
  [RecheckStatus.RESOLVED]: 'bg-green-500',
};

export function AnnotationModal() {
  const selectedAnnotation = useInspectionStore((state) => state.selectedAnnotation);
  const selectAnnotation = useInspectionStore((state) => state.selectAnnotation);
  const updateAnnotation = useInspectionStore((state) => state.updateAnnotation);
  const inspectionData = useInspectionStore((state) => state.inspectionData);

  const annotation = inspectionData?.annotations.find(
    (a) => a.id === selectedAnnotation
  );

  if (!annotation) return null;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => selectAnnotation(null)}
      />
      <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className={cn('w-3 h-3 rounded-full', levelColors[annotation.crackLevel])} />
            <h3 className="text-lg font-semibold text-white">
              {levelLabels[annotation.crackLevel]}裂纹详情
            </h3>
          </div>
          <button
            onClick={() => selectAnnotation(null)}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative rounded-xl overflow-hidden bg-slate-800">
            <img
              src={annotation.photoUrl}
              alt="裂纹照片"
              className="w-full h-48 object-cover"
              style={{ transform: `rotate(${annotation.photoOrientation}deg)` }}
            />
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full text-xs text-white">
              <Camera size={14} />
              照片朝向: {annotation.photoOrientation}°
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-2">裂纹等级</label>
              <div className="flex gap-2">
                {Object.values(CrackLevel).map((level) => (
                  <button
                    key={level}
                    onClick={() => updateAnnotation(annotation.id, { crackLevel: level })}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm transition-colors',
                      annotation.crackLevel === level
                        ? `${levelColors[level]} text-white`
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    )}
                  >
                    {levelLabels[level]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">复检状态</label>
              <div className="flex gap-2">
                {Object.values(RecheckStatus).map((status) => (
                  <button
                    key={status}
                    onClick={() => updateAnnotation(annotation.id, { recheckStatus: status })}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm transition-colors',
                      annotation.recheckStatus === status
                        ? `${statusColors[status]} text-white`
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    )}
                  >
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">位置坐标</label>
            <div className="px-4 py-2 bg-slate-800 rounded-lg font-mono text-sm text-cyan-400">
              X: {annotation.position[0].toFixed(2)}, Y: {annotation.position[1].toFixed(2)}, Z: {annotation.position[2].toFixed(2)}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">描述信息</label>
            <p className="text-sm text-slate-200">{annotation.description}</p>
          </div>

          <div className="pt-4 border-t border-slate-700 flex justify-between text-sm">
            <span className="text-slate-400">标注时间</span>
            <span className="text-slate-200">{formatTime(annotation.timestamp)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
