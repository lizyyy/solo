import { User, Clock, FileText, Lightbulb } from 'lucide-react';
import type { SourceInfo, SourceType } from '../../types/game';
import { useSourceTracker } from '../../hooks/useSourceTracker';

interface SourceCardProps {
  sourceInfo: SourceInfo;
  showSuggestion?: boolean;
  className?: string;
}

export function SourceCard({ sourceInfo, showSuggestion = true, className = '' }: SourceCardProps) {
  const { getSourceTypeLabel, getSourceTypeColor } = useSourceTracker();

  return (
    <div className={`text-xs text-neutral-500 border-t border-neutral-100 pt-3 mt-3 ${className}`}>
      <div className="flex items-center gap-4 flex-wrap mb-2">
        <span className={`badge ${getSourceTypeColor(sourceInfo.sourceType as SourceType)}`}>
          {getSourceTypeLabel(sourceInfo.sourceType as SourceType)}
        </span>
        <div className="flex items-center gap-1">
          <FileText size={12} />
          <span className="truncate max-w-[200px]" title={sourceInfo.originalSource}>
            {sourceInfo.originalSource}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <User size={12} />
          <span>{sourceInfo.processor}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{sourceInfo.processTime}</span>
        </div>
      </div>
      {showSuggestion && sourceInfo.suggestion && (
        <div className="mt-3 p-3 bg-primary-50 rounded border-l-4 border-primary-500">
          <div className="flex items-start gap-2">
            <Lightbulb size={14} className="text-primary-500 mt-0.5 flex-shrink-0" />
            <p className="text-primary-700 text-xs leading-relaxed">
              {sourceInfo.suggestion}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
