import { FileText, AlertTriangle, Clock, History, ChevronRight, Camera, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Material } from '@/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';

interface MaterialCardProps {
  material: Material;
  recordCount: number;
  isSelected: boolean;
  onClick: () => void;
}

export function MaterialCard({ material, recordCount, isSelected, onClick }: MaterialCardProps) {
  const hasNote = material.manualNote.length > 0;
  const hasScreenshot = material.screenshotUrl.length > 0;
  const hasChanges = recordCount > 1;
  const isException = material.status === 'exception';
  const changeCount = recordCount - 1;

  return (
    <div
      onClick={onClick}
      className={`industrial-card p-4 cursor-pointer transition-all duration-200 relative corner-accent ${
        isSelected
          ? 'border-primary-500 ring-1 ring-primary-500/50 shadow-lg shadow-primary-900/20'
          : 'hover:border-primary-600 hover:shadow-md hover:shadow-primary-900/10'
      } ${isException ? 'exception-pulse' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`status-dot ${STATUS_COLORS[material.status]} ${isException ? 'animate-pulse' : ''}`} />
          <span
            className={`text-xs font-medium ${
              material.status === 'normal'
                ? 'text-success-400'
                : material.status === 'withdrawn'
                ? 'text-danger-400'
                : material.status === 'changed'
                ? 'text-primary-400'
                : 'text-warning-400'
            }`}
          >
            {STATUS_LABELS[material.status]}
          </span>
          {hasChanges && (
            <span className="badge bg-industrial-700 text-industrial-300 flex items-center gap-1">
              <History className="w-3 h-3" />
              {changeCount}次变更
            </span>
          )}
        </div>
        <ChevronRight
          className={`w-4 h-4 text-industrial-500 transition-transform ${
            isSelected ? 'translate-x-0.5 text-primary-400' : ''
          }`}
        />
      </div>

      <div className="mb-2">
        <h3 className="text-sm font-semibold text-industrial-100 mb-1 line-clamp-1">
          {material.projectName}
        </h3>
        <div className="flex items-center gap-2 text-xs text-industrial-400">
          <span className="font-mono">{material.buildingNo}</span>
          <span className="text-industrial-600">·</span>
          <span>{material.materialType}</span>
        </div>
      </div>

      <div className="font-mono text-xs text-industrial-500 mb-3">
        <FileText className="w-3 h-3 inline mr-1" />
        {material.surveyNo}
      </div>

      <div className="bg-industrial-900/50 rounded p-2.5 mb-3 border border-industrial-700/50">
        <p className="text-xs text-industrial-300 line-clamp-2">
          <span className="text-industrial-500">当前结论：</span>
          {material.currentConclusion}
        </p>
      </div>

      {material.status === 'exception' && (
        <div className="bg-warning-900/20 border border-warning-700/50 rounded p-2 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-warning-300 font-medium mb-1">异常提醒</p>
              <p className="text-warning-400/80 line-clamp-2">{material.exceptionReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {hasNote && (
            <span className="p-1 bg-primary-900/30 rounded text-primary-400" title="有备注">
              <StickyNote className="w-3.5 h-3.5" />
            </span>
          )}
          {hasScreenshot && (
            <span className="p-1 bg-success-900/30 rounded text-success-400" title="有截图">
              <Camera className="w-3.5 h-3.5" />
            </span>
          )}
          {material.isPending && (
            <span className="p-1 bg-warning-900/30 rounded text-warning-400" title="待处理">
              <Clock className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        <span className="text-xs text-industrial-500 font-mono">
          {format(new Date(material.importDate), 'MM-dd', { locale: zhCN })}
        </span>
      </div>
    </div>
  );
}
