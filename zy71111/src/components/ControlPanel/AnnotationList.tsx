
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { CrackLevel, RecheckStatus } from '../../types';
import { useInspectionStore } from '../../store/useInspectionStore';
import { cn } from '../../lib/utils';

const EMPTY_ARRAY: never[] = [];

const levelIcons: Record<CrackLevel, React.ReactNode> = {
  [CrackLevel.LIGHT]: <AlertTriangle size={14} className="text-green-500" />,
  [CrackLevel.MODERATE]: <AlertTriangle size={14} className="text-orange-500" />,
  [CrackLevel.SEVERE]: <AlertTriangle size={14} className="text-red-500" />,
};

const statusIcons: Record<RecheckStatus, React.ReactNode> = {
  [RecheckStatus.PENDING]: <Clock size={12} className="text-yellow-500" />,
  [RecheckStatus.VERIFIED]: <CheckCircle size={12} className="text-cyan-500" />,
  [RecheckStatus.RESOLVED]: <CheckCircle size={12} className="text-green-500" />,
};

const levelLabels: Record<CrackLevel, string> = {
  [CrackLevel.LIGHT]: '轻微',
  [CrackLevel.MODERATE]: '中等',
  [CrackLevel.SEVERE]: '严重',
};

export function AnnotationList() {
  const inspectionData = useInspectionStore((state) => state.inspectionData);
  const filterLevel = useInspectionStore((state) => state.filterLevel);
  const filterStatus = useInspectionStore((state) => state.filterStatus);
  const selectedAnnotation = useInspectionStore((state) => state.selectedAnnotation);
  const selectAnnotation = useInspectionStore((state) => state.selectAnnotation);

  const annotations = inspectionData?.annotations || EMPTY_ARRAY;
  const filteredAnnotations = annotations.filter(
    (ann) => filterLevel.includes(ann.crackLevel) && filterStatus.includes(ann.recheckStatus)
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {filteredAnnotations.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          暂无符合筛选条件的标注
        </div>
      ) : (
        filteredAnnotations.map((ann) => (
          <button
            key={ann.id}
            onClick={() => selectAnnotation(selectedAnnotation === ann.id ? null : ann.id)}
            className={cn(
              'w-full text-left p-3 rounded-lg transition-all',
              selectedAnnotation === ann.id
                ? 'bg-cyan-600/30 border border-cyan-500/50'
                : 'bg-slate-800/50 hover:bg-slate-700/50 border border-transparent'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {levelIcons[ann.crackLevel]}
                <span className="text-sm font-medium text-slate-200">
                  {levelLabels[ann.crackLevel]}裂纹
                </span>
              </div>
              <div className="flex items-center gap-1">
                {statusIcons[ann.recheckStatus]}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400 line-clamp-2">
              {ann.description}
            </p>
            <div className="mt-2 text-xs text-slate-500">
              {formatTime(ann.timestamp)}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
