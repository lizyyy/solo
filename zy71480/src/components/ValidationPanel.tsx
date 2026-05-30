import { AlertCircle, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { ERROR_TYPE_LABELS, ERROR_TYPE_COLORS, ValidationError } from '../types';

export function ValidationPanel() {
  const { errors, results, selectResult, selectedResultId } = useStore();

  const criticalErrors = errors.filter((e) => e.severity === 'error');
  const warnings = errors.filter((e) => e.severity === 'warning');

  const handleJumpToResult = (resultId: string) => {
    selectResult(resultId === selectedResultId ? null : resultId);
  };

  const getAffectedResults = (error: ValidationError) => {
    return error.affectedResultIds
      .map((id) => results.find((r) => r.id === id))
      .filter(Boolean);
  };

  const renderErrorCard = (error: ValidationError) => {
    const affectedResults = getAffectedResults(error);
    const isError = error.severity === 'error';

    return (
      <div
        key={error.id}
        className={`p-3 rounded-lg border ${
          isError
            ? 'bg-accent-danger/10 border-accent-danger/30'
            : 'bg-accent-warning/10 border-accent-warning/30'
        }`}
      >
        <div className="flex items-start gap-2 mb-2">
          {isError ? (
            <AlertCircle size={16} className="text-accent-danger flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={16} className="text-accent-warning flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${ERROR_TYPE_COLORS[error.type]}`} />
              <span className={`text-sm font-medium ${isError ? 'text-accent-danger' : 'text-accent-warning'}`}>
                {ERROR_TYPE_LABELS[error.type]}
              </span>
              <span className="text-xs text-gray-500">
                影响 {error.affectedCount} 个测点
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{error.description}</p>
          </div>
        </div>

        {affectedResults.length > 0 && (
          <div className="mt-2 pt-2 border-t border-acoustic-700">
            <div className="text-xs text-gray-500 mb-2">受影响的测点（点击跳转）:</div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {affectedResults.slice(0, 20).map((result) => (
                <button
                  key={result!.id}
                  onClick={() => handleJumpToResult(result!.id)}
                  className={`
                    px-2 py-1 text-xs font-mono rounded transition-colors
                    ${selectedResultId === result!.id
                      ? 'bg-accent-primary text-white'
                      : 'bg-acoustic-700 text-gray-400 hover:bg-acoustic-600 hover:text-white'
                    }
                  `}
                >
                  ({result!.x.toFixed(1)}, {result!.y.toFixed(1)})
                  <ChevronRight size={10} className="inline ml-0.5" />
                </button>
              ))}
              {affectedResults.length > 20 && (
                <span className="px-2 py-1 text-xs text-gray-500">
                  +{affectedResults.length - 20} 更多
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-acoustic-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-acoustic-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">校验结果</h2>
          <div className="flex items-center gap-3 text-sm">
            {errors.length === 0 ? (
              <div className="flex items-center gap-1 text-accent-success">
                <CheckCircle size={14} />
                <span>全部通过</span>
              </div>
            ) : (
              <>
                {criticalErrors.length > 0 && (
                  <div className="flex items-center gap-1 text-accent-danger">
                    <AlertCircle size={14} />
                    <span>{criticalErrors.length} 错误</span>
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="flex items-center gap-1 text-accent-warning">
                    <AlertTriangle size={14} />
                    <span>{warnings.length} 警告</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-h-64 overflow-y-auto">
        {results.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">暂无计算数据</p>
          </div>
        ) : errors.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle size={32} className="mx-auto text-accent-success mb-2 opacity-50" />
            <p className="text-sm text-gray-400">所有校验项已通过</p>
            <p className="text-xs text-gray-600 mt-1">延时方向正确 | 无相位抵消漏算 | 声压在阈值内</p>
          </div>
        ) : (
          <div className="space-y-3">
            {criticalErrors.map(renderErrorCard)}
            {warnings.map(renderErrorCard)}
          </div>
        )}
      </div>
    </div>
  );
}
