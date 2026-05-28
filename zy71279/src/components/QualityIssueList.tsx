import React from 'react';
import type { ConstraintCheck, DetailedError } from '@/types';
import { AlertCircle, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

interface QualityIssueListProps {
  qualityErrors: DetailedError[];
  constraintChecks: ConstraintCheck[];
  maxItems?: number;
}

export const QualityIssueList: React.FC<QualityIssueListProps> = ({
  qualityErrors,
  constraintChecks,
  maxItems = 20
}) => {
  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const getSeverityBadge = (severity: 'error' | 'warning' | 'info') => {
    const baseClasses = 'px-2 py-0.5 text-xs font-medium rounded-full';
    switch (severity) {
      case 'error':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>错误</span>;
      case 'warning':
        return <span className={`${baseClasses} bg-amber-100 text-amber-700`}>警告</span>;
      case 'info':
        return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>提示</span>;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      normal_flip: '法线翻转',
      hole: '孔洞',
      error_scale: '误差尺度',
      degenerate_face: '退化面',
      non_manifold: '非流形',
      other: '其他'
    };
    return labels[type] || type;
  };

  const displayErrors = qualityErrors.slice(0, maxItems);
  const hasMore = qualityErrors.length > maxItems;

  const errorCount = qualityErrors.filter(e => e.severity === 'error').length;
  const warningCount = qualityErrors.filter(e => e.severity === 'warning').length;
  const infoCount = qualityErrors.filter(e => e.severity === 'info').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <AlertCircle className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">拓扑质量检查:</span>
        </div>
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle className="w-4 h-4" />
            {errorCount} 个错误
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            {warningCount} 个警告
          </span>
        )}
        {infoCount > 0 && (
          <span className="flex items-center gap-1 text-blue-600">
            <Info className="w-4 h-4" />
            {infoCount} 个提示
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && infoCount === 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            全部通过
          </span>
        )}
      </div>

      {constraintChecks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">约束检查结果</h4>
          <div className="grid grid-cols-1 gap-2">
            {constraintChecks.map((check, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  check.passed
                    ? 'bg-green-50 border-green-200'
                    : check.severity === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {check.passed ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    getSeverityIcon(check.severity)
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {check.constraintName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {check.details}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">
                    {check.actualValue.toFixed(4)} / {check.allowedValue.toFixed(4)}
                  </div>
                  {!check.passed && getSeverityBadge(check.severity)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {displayErrors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">详细问题列表</h4>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {displayErrors.map((error, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-2 rounded-lg text-sm ${
                  error.severity === 'error'
                    ? 'bg-red-50'
                    : error.severity === 'warning'
                      ? 'bg-amber-50'
                      : 'bg-blue-50'
                }`}
              >
                {getSeverityIcon(error.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                      error.severity === 'error'
                        ? 'bg-red-200 text-red-800'
                        : error.severity === 'warning'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-blue-200 text-blue-800'
                    }`}>
                      {getTypeLabel(error.type)}
                    </span>
                    {error.faceIndex !== undefined && (
                      <span className="text-xs text-gray-500 font-mono">
                        面 #{error.faceIndex}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mt-1">{error.message}</p>
                  {error.location && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      位置: ({error.location[0].toFixed(3)}, {error.location[1].toFixed(3)}, {error.location[2].toFixed(3)})
                    </p>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="text-center text-xs text-gray-400 py-2">
                还有 {qualityErrors.length - maxItems} 条问题未显示
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
