import { Calculator, Info, GitBranch, User } from 'lucide-react';
import type { ForecastResult } from '../types';
import { formatValue, getReviewStatusText } from '../utils/exponentialSmoothing';

interface Props {
  result: ForecastResult;
}

export default function CalculationDetail({ result }: Props) {
  const maxHistorical = Math.max(...result.historicalData, 1);
  const maxSmoothed = Math.max(...result.smoothedData, 1);

  const paramsMatch = result.calculationDetail.match(/alpha[\s:]*([\d.]+)[,\s]*beta[\s:]*([\d.]+)[,\s]*gamma[\s:]*([\d.]+)/i);
  const alpha = paramsMatch ? parseFloat(paramsMatch[1]) : null;
  const beta = paramsMatch ? parseFloat(paramsMatch[2]) : null;
  const gamma = paramsMatch ? parseFloat(paramsMatch[3]) : null;

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
      {result.isMixedFormat && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">混合格式警告</p>
              <p className="text-sm text-amber-700">
                当前产品包含混合格式（小数和百分比混用），请注意检查参数的一致性。
              </p>
            </div>
          </div>
        </div>
      )}

      {result.reviewStatus === 'pending_review' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-amber-800">待活动负责人复核</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">计算过程明细</h4>
          </div>

          {(alpha !== null || beta !== null || gamma !== null) && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">使用参数</div>
              <div className="flex flex-wrap gap-3">
                {alpha !== null && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">alpha:</span>
                    <span className="font-mono font-semibold text-blue-700">{alpha.toFixed(4)}</span>
                  </div>
                )}
                {beta !== null && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">beta:</span>
                    <span className="font-mono font-semibold text-blue-700">{beta.toFixed(4)}</span>
                  </div>
                )}
                {gamma !== null && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">gamma:</span>
                    <span className="font-mono font-semibold text-blue-700">{gamma.toFixed(4)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">历史销量</div>
            <div className="space-y-1">
              {result.historicalData.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-6">{index + 1}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded transition-all duration-500"
                      style={{ width: `${(value / maxHistorical) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-700 w-20 text-right">
                    {formatValue(value, result.valueFormat)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">平滑数据</div>
            <div className="space-y-1">
              {result.smoothedData.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-6">{index + 1}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded transition-all duration-500"
                      style={{ width: `${(value / maxSmoothed) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-700 w-20 text-right">
                    {formatValue(value, result.valueFormat)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">参数版本</h4>
            </div>
            <div className="font-mono text-purple-700 bg-purple-50 px-3 py-2 rounded-lg font-medium">
              {result.parameterVersion}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-amber-600" />
              <h4 className="font-semibold text-gray-900">取舍理由</h4>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
              {result.tradeoffReason}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-indigo-600" />
              <h4 className="font-semibold text-gray-900">复核状态</h4>
            </div>
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                result.reviewStatus === 'pending_review'
                  ? 'bg-amber-100 text-amber-700'
                  : result.reviewStatus === 'reviewed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {getReviewStatusText(result.reviewStatus)}
              </span>
              {result.reviewedBy && (
                <span className="text-sm text-gray-600">
                  复核人：{result.reviewedBy}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-5 h-5 text-gray-600" />
              <h4 className="font-semibold text-gray-900">计算明细</h4>
            </div>
            <div className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg font-mono leading-relaxed">
              {result.calculationDetail}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
