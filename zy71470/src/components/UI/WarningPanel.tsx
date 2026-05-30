import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ValidationWarning } from '@/types';
import { getWarningSeverityColor } from '@/utils/validation';

interface WarningPanelProps {
  warnings: ValidationWarning[];
}

const getIcon = (level: ValidationWarning['level']) => {
  switch (level) {
    case 'error':
      return <XCircle size={18} className="flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle size={18} className="flex-shrink-0" />;
    case 'info':
      return <Info size={18} className="flex-shrink-0" />;
  }
};

const getLevelLabel = (level: ValidationWarning['level']) => {
  switch (level) {
    case 'error':
      return '错误';
    case 'warning':
      return '警告';
    case 'info':
      return '提示';
  }
};

export const WarningPanel = ({ warnings }: WarningPanelProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (warnings.length === 0) {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
        <div className="flex items-center gap-2 text-green-400">
          <Info size={18} />
          <span className="text-sm font-medium">参数验证通过</span>
        </div>
        <p className="text-xs text-green-400/70 mt-1">所有参数在合理范围内，计算结果可靠</p>
      </div>
    );
  }

  const errorCount = warnings.filter((w) => w.level === 'error').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;
  const infoCount = warnings.filter((w) => w.level === 'info').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs">
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle size={14} />
            {errorCount} 项错误
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <AlertTriangle size={14} />
            {warningCount} 项警告
          </span>
        )}
        {infoCount > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <Info size={14} />
            {infoCount} 项提示
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {warnings.map((warning) => (
          <div
            key={warning.id}
            className={`rounded-lg border overflow-hidden transition-all ${getWarningSeverityColor(warning.level)}`}
          >
            <button
              onClick={() => setExpandedId(expandedId === warning.id ? null : warning.id)}
              className="w-full p-3 flex items-start gap-2 text-left"
            >
              {getIcon(warning.level)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{warning.message}</span>
                  {expandedId === warning.id ? (
                    <ChevronUp size={16} className="flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="flex-shrink-0" />
                  )}
                </div>
              </div>
            </button>

            {expandedId === warning.id && (
              <div className="px-3 pb-3 pt-0 border-t border-current/20">
                <div className="mt-2">
                  <p className="text-xs font-semibold mb-1 opacity-80">级别: {getLevelLabel(warning.level)}</p>
                  <p className="text-xs font-semibold mb-1 opacity-80">影响的计算环节:</p>
                  <ul className="text-xs opacity-70 space-y-0.5 mb-2">
                    {warning.affectedCalculations.map((calc, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-current" />
                        {calc}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs">
                    <span className="font-semibold opacity-80">建议: </span>
                    <span className="opacity-70">{warning.suggestion}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
