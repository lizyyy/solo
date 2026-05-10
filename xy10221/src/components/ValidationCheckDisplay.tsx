import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ValidationResult } from '../types';

interface ValidationCheckDisplayProps {
  result: ValidationResult;
}

export function ValidationCheckDisplay({ result }: ValidationCheckDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">验证结果</h3>
        <div className="flex items-center gap-2">
          {result.overallStatus === 'passed' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
              <CheckCircle className="w-4 h-4" />
              通过
            </span>
          )}
          {result.overallStatus === 'failed' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
              <XCircle className="w-4 h-4" />
              失败
            </span>
          )}
          {result.overallStatus === 'retry' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
              <AlertCircle className="w-4 h-4" />
              可重试
            </span>
          )}
        </div>
      </div>

      {result.needsManualReview && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">需要人工处理</p>
              <p className="text-sm text-orange-700 mt-1">{result.manualReviewReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {result.checks.map((check, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${
              check.passed
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {check.passed ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${check.passed ? 'text-green-800' : 'text-red-800'}`}>
                  {check.name}
                </p>
                <p className={`text-sm mt-1 ${check.passed ? 'text-green-700' : 'text-red-700'}`}>
                  {check.message}
                </p>
                {check.details && Object.keys(check.details).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      查看详情
                    </summary>
                    <pre className="mt-2 p-2 bg-white rounded text-xs text-gray-600 overflow-x-auto">
                      {JSON.stringify(check.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {result.retryInstructions && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800">重试指引</p>
          <p className="text-sm text-blue-700 mt-1">{result.retryInstructions}</p>
        </div>
      )}
    </div>
  );
}
