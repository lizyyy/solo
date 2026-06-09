import { Calculator, Info, GitBranch, User, ArrowRight, AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { ForecastResult } from '../types';
import { formatValue, getReviewStatusText } from '../utils/exponentialSmoothing';

interface Props {
  result: ForecastResult;
}

const formatParamCell = (raw: string, parsed: number, isPct: boolean) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1">
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
        isPct ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'
      }`}>
        {raw}
      </span>
      {isPct && <span className="text-[10px] text-rose-600 uppercase tracking-wide">百分数</span>}
      {!isPct && raw.includes('%') === false && (typeof parseFloat(raw) === 'number') && (
        <span className="text-[10px] text-blue-600 uppercase tracking-wide">小数</span>
      )}
    </div>
    {isPct && (
      <div className="flex items-center gap-1 text-[11px] text-gray-500">
        <ArrowRight className="w-3 h-3" />
        归一化: <span className="font-mono text-gray-700">{parsed.toFixed(4)}</span>
      </div>
    )}
  </div>
);

export default function CalculationDetail({ result }: Props) {
  const maxHistorical = Math.max(...result.historicalData, 1);
  const maxSmoothed = Math.max(...result.smoothedData, 1);

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 space-y-4">
      {/* 混合格式：原始 vs 归一化 对比卡片 */}
      {result.mixedFormatInfo && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
          <div className="flex items-start gap-3 mb-3">
            <AlertOctagon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">混合格式检测结果（未自动归为正常）</p>
              <p className="text-sm text-amber-700 mb-2">
                {result.mixedFormatInfo.originalDescription}
              </p>
              <p className="text-sm text-amber-700">
                {result.mixedFormatInfo.normalizedDescription}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-amber-600 uppercase tracking-wide mb-1">下一步</div>
              <div className="text-sm font-semibold text-amber-900 bg-amber-100 px-3 py-1 rounded-lg">
                → {result.mixedFormatInfo.nextOwner}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded-lg border border-amber-200">
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">alpha</div>
              {formatParamCell(result.mixedFormatInfo.rawAlpha, result.mixedFormatInfo.parsedAlpha, result.mixedFormatInfo.hasPercentage[0])}
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">beta</div>
              {formatParamCell(result.mixedFormatInfo.rawBeta, result.mixedFormatInfo.parsedBeta, result.mixedFormatInfo.hasPercentage[1])}
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">gamma</div>
              {formatParamCell(result.mixedFormatInfo.rawGamma, result.mixedFormatInfo.parsedGamma, result.mixedFormatInfo.hasPercentage[2])}
            </div>
          </div>
        </div>
      )}

      {/* 非混合格式时，用正常参数展示 */}
      {!result.mixedFormatInfo && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">使用参数（格式一致）</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600">alpha:</span>
              <span className="font-mono font-semibold text-blue-700">{result.rawAlpha} = {result.parsedAlpha.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600">beta:</span>
              <span className="font-mono font-semibold text-blue-700">{result.rawBeta} = {result.parsedBeta.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600">gamma:</span>
              <span className="font-mono font-semibold text-blue-700">{result.rawGamma} = {result.parsedGamma.toFixed(4)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 冲突决策卡片 */}
      {result.conflictDecision && (
        <div className={`p-4 rounded-xl border-2 ${
          result.conflictDecision.resolution === 'accept_example'
            ? 'bg-green-50 border-green-300'
            : 'bg-violet-50 border-violet-300'
        }`}>
          <div className="flex items-start gap-3 mb-3">
            {result.conflictDecision.resolution === 'accept_example' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-semibold ${
                result.conflictDecision.resolution === 'accept_example' ? 'text-green-900' : 'text-violet-900'
              }`}>
                冲突决策：{result.conflictDecision.resolution === 'accept_example' ? '采纳手算反例' : '驳回维持原参数'}
              </p>
              <p className={`text-sm mt-1 ${
                result.conflictDecision.resolution === 'accept_example' ? 'text-green-700' : 'text-violet-700'
              }`}>
                {result.conflictDecision.originalStatement}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-xs uppercase tracking-wide mb-1 ${
                result.conflictDecision.resolution === 'accept_example' ? 'text-green-600' : 'text-violet-600'
              }`}>决策值</div>
              <div className={`text-lg font-bold ${
                result.conflictDecision.resolution === 'accept_example' ? 'text-green-800' : 'text-violet-800'
              }`}>
                {result.conflictDecision.updatedValue}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg border ${
              result.conflictDecision.resolution === 'accept_example' ? 'bg-white border-green-200' : 'bg-white border-violet-200'
            }`}>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">原始说法 → 改后的值</div>
              <div className="text-sm font-mono text-gray-800 space-y-1">
                <div>参数结论: <span className="line-through text-gray-400">{result.conflictDecision.parameterValue}</span></div>
                <div>手算反例: <span className="line-through text-gray-400">{result.conflictDecision.exampleValue}</span></div>
                <div className="pt-1 border-t border-dashed border-gray-200">
                  改后值: <span className="font-bold">{result.conflictDecision.updatedValue}</span>
                  <span className="text-gray-500"> （差异 {Math.abs(result.conflictDecision.diffPercentage).toFixed(2)}%）</span>
                </div>
              </div>
            </div>
            <div className={`p-3 rounded-lg border ${
              result.conflictDecision.resolution === 'accept_example' ? 'bg-white border-green-200' : 'bg-white border-violet-200'
            }`}>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">处理原因 · 下一步找谁</div>
              <div className="text-sm text-gray-700 mb-2">{result.conflictDecision.changeReason || '（未填写）'}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  <User className="w-3 h-3 inline mr-1" />
                  {result.conflictDecision.resolvedBy}
                </span>
                <span className={`px-2 py-1 rounded-lg font-medium ${
                  result.conflictDecision.resolution === 'accept_example' ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'
                }`}>
                  → {result.conflictDecision.nextOwner}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 复核链路时间轴 */}
      <div className="p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-5 h-5 text-indigo-600" />
          <h4 className="font-semibold text-gray-900">复核链路（原始说法 → 改后值 → 处理原因 → 下一步找谁）</h4>
        </div>
        <ol className="relative border-l-2 border-gray-200 ml-2 space-y-3">
          {result.reviewChain.map((entry, idx) => (
            <li key={idx} className="ml-5">
              <span className="absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-indigo-400 text-[11px] font-bold text-indigo-600">
                {idx + 1}
              </span>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900">{entry.action}</span>
                  <span className="text-[11px] text-gray-400">{new Date(entry.timestamp).toLocaleString('zh-CN')}</span>
                </div>
                {entry.originalValue && (
                  <div className="text-xs text-gray-600 mb-1">
                    <span className="text-gray-500">原始值/说法：</span>
                    <span className="font-mono text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">{entry.originalValue}</span>
                  </div>
                )}
                {entry.updatedValue && (
                  <div className="text-xs text-gray-600 mb-1">
                    <span className="text-gray-500">改后值：</span>
                    <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{entry.updatedValue}</span>
                  </div>
                )}
                {entry.reason && (
                  <div className="text-xs text-gray-600 mb-1">
                    <span className="text-gray-500">处理原因：</span>
                    <span className="text-gray-800">{entry.reason}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 text-[11px] border-t border-dashed border-gray-200 pt-2">
                  <span className="text-gray-500">经手人：{entry.operator || '系统'}</span>
                  <span className="text-indigo-600 font-medium px-2 py-0.5 bg-indigo-50 rounded">
                    → 下一步：{entry.nextOwner || '业务确认'}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* 待复核提示 */}
      {result.reviewStatus === 'pending_review' && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-800">
                该记录尚未归为正常结果 — 待活动负责人复核
              </span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              result.reviewStatus === 'pending_review'
                ? 'bg-amber-100 text-amber-700'
                : result.reviewStatus === 'reviewed'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {getReviewStatusText(result.reviewStatus)}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 历史 + 平滑数据 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">计算过程明细</h4>
          </div>

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
                      style={{ width: `${Math.min(100, (value / maxSmoothed) * 100)}%` }}
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

        {/* 版本 / 取舍 / 状态 */}
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
              <h4 className="font-semibold text-gray-900">计算明细（统一数据源）</h4>
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
