import type { ValidationResult, RiskLevel, ValidationCategory } from '../types';
import { riskLevelColors, riskLevelLabels, categoryLabels } from '../utils/geometry';

interface ValidationPanelProps {
  results: ValidationResult[];
  onFocusResult: (result: ValidationResult) => void;
}

export function ValidationPanel({ results, onFocusResult }: ValidationPanelProps) {
  const failedResults = results.filter(r => !r.passed);
  const passedResults = results.filter(r => r.passed);

  const byLevel = {
    critical: failedResults.filter(r => r.riskLevel === 'critical').length,
    high: failedResults.filter(r => r.riskLevel === 'high').length,
    medium: failedResults.filter(r => r.riskLevel === 'medium').length,
    low: failedResults.filter(r => r.riskLevel === 'low').length
  };

  const byCategory = {
    safety: failedResults.filter(r => r.category === 'safety').length,
    flow: failedResults.filter(r => r.category === 'flow').length,
    power: failedResults.filter(r => r.category === 'power').length,
    layout: failedResults.filter(r => r.category === 'layout').length,
    compliance: failedResults.filter(r => r.category === 'compliance').length
  };

  const totalIssues = failedResults.length;

  const getLevelIcon = (level: RiskLevel) => {
    switch (level) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-lg">规则校验</h3>
        <p className="text-sm text-gray-500 mt-1">
          {totalIssues === 0 
            ? '所有校验通过' 
            : `发现 ${totalIssues} 个问题`}
        </p>
      </div>

      {totalIssues > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-2 mb-3">
          {(['critical', 'high', 'medium', 'low'] as RiskLevel[]).map(level => (
            <div 
              key={level}
              className={`flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ backgroundColor: riskLevelColors[level] + '15' }}
            >
              <span className="text-sm font-medium" style={{ color: riskLevelColors[level] }}>
                {riskLevelLabels[level]}
              </span>
              <span 
                className="text-sm font-bold" style={{ color: riskLevelColors[level] }}>
                {byLevel[level]}
              </span>
            </div>
          ))}
          </div>
          
          <div className="flex flex-wrap gap-1">
            {Object.entries(byCategory).filter(([, count]) => count > 0).map(([category, count]) => (
              <span 
                key={category}
                className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded-full"
              >
                {categoryLabels[category as ValidationCategory]}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {failedResults.length > 0 ? (
          <div className="space-y-3">
            {failedResults
              .sort((a, b) => {
                const order: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                return order[a.riskLevel] - order[b.riskLevel];
              })
              .map((result, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow"
                  style={{
                    borderColor: riskLevelColors[result.riskLevel] + '40',
                    backgroundColor: riskLevelColors[result.riskLevel] + '08'
                  }}
                  onClick={() => onFocusResult(result)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{getLevelIcon(result.riskLevel)}</span>
                    <div className="flex-1 min-w-0">
                      <h4 
                        className="font-medium text-sm"
                        style={{ color: riskLevelColors[result.riskLevel] }}
                      >
                        {result.ruleName}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">{result.message}</p>
                      {result.details && (
                        <p className="text-xs text-gray-500 mt-1">{result.details}</p>
                      )}
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-xs text-gray-500 rounded">
                        {categoryLabels[result.category]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-600">所有规则校验通过</p>
            <p className="text-sm text-gray-400 mt-1">布展方案符合规范要求</p>
          </div>
        )}
      </div>

      {passedResults.length > 0 && (
        <details className="border-t border-gray-200">
          <summary className="p-4 cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            通过的规则 ({passedResults.length})
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {passedResults.map((result, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-500">
                <span>✓</span>
                <span>{result.ruleName}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
