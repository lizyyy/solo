import React, { useState } from 'react';
import { formatIssueType, getIssueTypeColor } from '../../utils/format';
import { AlertTriangle, ChevronDown, ChevronUp, Info, Zap } from 'lucide-react';
import type { QualityIssue } from '../../types';

interface AlertCardProps {
  issue: QualityIssue;
  onJumpToRow?: (dataId: string) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ issue, onJumpToRow }) => {
  const [expanded, setExpanded] = useState(false);
  const color = getIssueTypeColor(issue.type);

  const bgColors: Record<string, string> = {
    null: 'bg-warning-50 border-warning-200',
    duplicate: 'bg-historical-50 border-historical-200',
    unit_mismatch: 'bg-blue-50 border-blue-200',
    anomaly: 'bg-danger-50 border-danger-200',
  };

  const iconColors: Record<string, string> = {
    null: 'text-warning-600',
    duplicate: 'text-historical-600',
    unit_mismatch: 'text-blue-600',
    anomaly: 'text-danger-600',
  };

  return (
    <div 
      className={`card ${bgColors[issue.type]} border-l-4 transition-all duration-200 hover:shadow-engineering-hover cursor-pointer`}
      style={{ borderLeftColor: color }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            <AlertTriangle className={`w-4 h-4 mt-0.5 ${iconColors[issue.type]}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '20', color }}>
                  {formatIssueType(issue.type)}
                </span>
                <span className="text-xs text-engineering-500">
                  第{issue.rowIndex}行 · {issue.field}
                </span>
              </div>
              <p className="text-sm text-engineering-800 mt-1 font-medium">
                {issue.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onJumpToRow && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToRow(issue.dataId);
                }}
                className="p-1 hover:bg-white/50 rounded-engineering text-engineering-600 hover:text-engineering-800 transition-colors"
                title="跳转至数据行"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}
            <button className="p-1 text-engineering-500 hover:text-engineering-700 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {expanded && (
          <div className="mt-3 pt-3 border-t border-engineering-200/50 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-engineering-500 flex items-center gap-1">
                  <Info className="w-3 h-3" /> 原始值：
                </span>
                <span className="font-mono-num ml-1 text-engineering-800">
                  {issue.originalValue}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-engineering-500">建议处理：</span>
                <span className="ml-1 text-engineering-800">{issue.suggestion}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertCard;
