import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, XCircle } from 'lucide-react';
import type { AnomalyItem } from '../types/auction';
import { getSeverityColor, getSeverityBorderColor, formatSeverity, formatAnomalyType } from '../utils/formatters';
import { cn } from '@/lib/utils';

interface AnomalyCardProps {
  anomaly: AnomalyItem;
  index: number;
}

export const AnomalyCard: React.FC<AnomalyCardProps> = ({ anomaly, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = () => {
    switch (anomaly.severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Info className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div
      className={cn(
        'border-l-4 bg-white rounded-r-md shadow-sm transition-all duration-200 hover:shadow-md',
        getSeverityBorderColor(anomaly.severity),
        isExpanded ? 'ring-1 ring-slate-200' : ''
      )}
    >
      <div
        className="p-4 cursor-pointer flex items-start justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{index + 1}.</span>
              <span className={cn('px-2 py-0.5 text-xs font-medium rounded', getSeverityColor(anomaly.severity))}>
                {formatSeverity(anomaly.severity)}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                {formatAnomalyType(anomaly.type)}
              </span>
            </div>
            <h4 className="mt-1 text-sm font-medium text-slate-900">{anomaly.title}</h4>
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{anomaly.description}</p>
          </div>
        </div>
        <button className="flex-shrink-0 ml-2 text-slate-400 hover:text-slate-600">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="mt-4 space-y-4">
            <div>
              <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">判断依据</h5>
              <p className="text-sm text-slate-600 leading-relaxed">{anomaly.basis}</p>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">影响评估</h5>
              <p className="text-sm text-slate-600 leading-relaxed">{anomaly.impact}</p>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">修正建议</h5>
              <p className="text-sm text-slate-600 leading-relaxed">{anomaly.suggestion}</p>
            </div>
            {anomaly.relatedData && anomaly.relatedData.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">关联数据</h5>
                <div className="flex flex-wrap gap-1">
                  {anomaly.relatedData.map((id, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded font-mono">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
