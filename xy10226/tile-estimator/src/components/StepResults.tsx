import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const StepResults: React.FC = () => {
  const { state, calculate, reset } = useApp();
  const { result, calculationSteps, dirtyDataRecords, validationErrors } = state;
  
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'assumptions' | 'issues' | 'steps'>('overview');

  if (!result) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          准备好计算了吗？
        </h3>
        <p className="text-gray-600 mb-6">
          点击下方按钮开始计算瓷砖需求量和损耗
        </p>
        <button
          onClick={calculate}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          🧮 开始计算
        </button>
      </div>
    );
  }

  const hasCriticalErrors = validationErrors.some(e => e.severity === 'error');
  const hasWarnings = validationErrors.some(e => e.severity === 'warning');
  const hasDirtyData = dirtyDataRecords.length > 0;
  const hasFeasibilityIssues = result.feasibility.issues.length > 0;

  return (
    <div className="space-y-6">
      {/* 顶部概览卡片 */}
      <div className={`p-6 rounded-2xl border-2 ${
        result.feasibility.isFeasible
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
          : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center gap-3">
              <span className="text-4xl">
                {result.feasibility.isFeasible ? '✅' : '⚠️'}
              </span>
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {result.feasibility.isFeasible ? '方案可行' : '方案存在风险'}
                </h3>
                <p className="text-sm text-gray-600">
                  可行性评分: <span className="font-bold text-lg">
                    {result.feasibility.score}/100
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {hasCriticalErrors && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                🔴 有错误
              </span>
            )}
            {hasWarnings && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                ⚡ 有警告
              </span>
            )}
            {hasDirtyData && (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                📝 数据清洗
              </span>
            )}
            {hasFeasibilityIssues && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                💡 {result.feasibility.issues.length} 个问题
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl text-white">
          <p className="text-sm opacity-80">总瓷砖需求</p>
          <p className="text-3xl font-bold">{result.tilesNeeded}</p>
          <p className="text-xs opacity-70 mt-1">块</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl text-white">
          <p className="text-sm opacity-80">采购盒数</p>
          <p className="text-3xl font-bold">{result.boxesNeeded}</p>
          <p className="text-xs opacity-70 mt-1">盒</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-xl text-white">
          <p className="text-sm opacity-80">损耗瓷砖</p>
          <p className="text-3xl font-bold">{result.wasteTiles}</p>
          <p className="text-xs opacity-70 mt-1">
            ({result.wastePercentage.toFixed(1)}%)
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-5 rounded-xl text-white">
          <p className="text-sm opacity-80">预估费用</p>
          <p className="text-3xl font-bold">¥{result.totalCost}</p>
          <p className="text-xs opacity-70 mt-1">
            净面积: {result.netArea.toFixed(1)}㎡
          </p>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'overview', label: '📋 结果概览', count: null },
          { id: 'breakdown', label: '🧮 计算分解', count: result.breakdown.length },
          { id: 'steps', label: '📝 执行步骤', count: calculationSteps.length },
          { id: 'assumptions', label: '💭 关键假设', count: result.assumptions.length },
          { id: 'issues', label: '⚠️ 问题列表', count: result.feasibility.issues.length + validationErrors.length + dirtyDataRecords.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 border border-gray-200 border-b-white'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 批次推荐 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">
                🎨 批次采购建议
              </h4>
              <div className="space-y-4">
                {result.batchRecommendations.map((batch, index) => (
                  <div
                    key={batch.batchNumber}
                    className={`p-4 rounded-lg border ${
                      index === 0
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          index === 0
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-400 text-white'
                        }`}>
                          {index === 0 ? '首选' : `备选${index}`}
                        </span>
                        <span className="font-medium text-gray-800">
                          批次: {batch.batchNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                          需要: <strong>{batch.boxesNeeded}</strong> 盒
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">颜色匹配:</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={star <= Math.ceil(batch.colorMatchScore * 5) ? 'text-yellow-500' : 'text-gray-300'}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <ul className="text-sm text-gray-600 space-y-1">
                        {batch.reasons.map((reason, i) => (
                          <li key={i}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 可行性问题 */}
            {hasFeasibilityIssues && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  🔍 可行性分析问题
                </h4>
                <div className="space-y-3">
                  {result.feasibility.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        issue.type === 'critical'
                          ? 'border-red-300 bg-red-50'
                          : issue.type === 'warning'
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-blue-300 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">
                          {issue.type === 'critical' ? '🚫' : issue.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            [{issue.category.toUpperCase()}] {issue.message}
                          </p>
                          {issue.suggestion && (
                            <p className="text-sm text-gray-600 mt-1">
                              💡 建议: {issue.suggestion}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            影响字段: {issue.affectedFields.join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'breakdown' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">步骤</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">输入</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">输出</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">公式</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.breakdown.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {item.step}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.input}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      {item.output}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                      {item.formula || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'steps' && (
          <div className="space-y-4">
            {calculationSteps.map((step, index) => (
              <div
                key={step.id}
                className={`bg-white rounded-xl border ${
                  step.success ? 'border-green-200' : 'border-red-200'
                } p-5`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      step.success ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <h5 className="font-semibold text-gray-800">
                        {step.success ? '✅' : '❌'} {step.title}
                      </h5>
                      <p className="text-sm text-gray-600 mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-medium mb-2">📥 输入参数</p>
                    <pre className="text-xs text-gray-700 overflow-x-auto">
                      {JSON.stringify(step.inputs, null, 2)}
                    </pre>
                  </div>
                  <div className={`rounded-lg p-3 ${step.outputs ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-xs text-gray-500 font-medium mb-2">
                      {step.outputs ? '📤 输出结果' : '❌ 失败原因'}
                    </p>
                    {step.outputs ? (
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(step.outputs, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-red-700">
                        {step.failureReason || '未知错误'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'assumptions' && (
          <div className="space-y-4">
            {result.assumptions.map((assumption, index) => (
              <div
                key={index}
                className={`bg-white rounded-xl border p-5 ${
                  assumption.impact === 'high'
                    ? 'border-red-200 bg-red-50/50'
                    : assumption.impact === 'medium'
                    ? 'border-yellow-200 bg-yellow-50/50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      assumption.impact === 'high'
                        ? 'bg-red-500 text-white'
                        : assumption.impact === 'medium'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-400 text-white'
                    }`}>
                      {assumption.impact === 'high' ? '高影响' : assumption.impact === 'medium' ? '中影响' : '低影响'}
                    </span>
                    <div>
                      <h5 className="font-semibold text-gray-800">
                        {assumption.title}
                      </h5>
                      <p className="text-sm text-gray-600 mt-1">
                        {assumption.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">来源: {assumption.source}</p>
                    {assumption.canBeModified ? (
                      <span className="text-xs text-green-600">✓ 可修改</span>
                    ) : (
                      <span className="text-xs text-gray-400">固定规则</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="space-y-6">
            {/* 验证错误 */}
            {validationErrors.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  🔴 验证错误 ({validationErrors.length})
                </h4>
                <div className="space-y-2">
                  {validationErrors.map((error, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        error.severity === 'error'
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={error.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}>
                          {error.severity === 'error' ? '🚫' : '⚠️'}
                        </span>
                        <span className="font-medium text-gray-800">
                          [{error.field}]
                        </span>
                        <span className="text-gray-700">
                          {error.message}
                        </span>
                        {error.value !== undefined && (
                          <span className="text-sm text-gray-500 ml-auto">
                            值: {error.value}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 脏数据记录 */}
            {dirtyDataRecords.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  📝 数据清洗记录 ({dirtyDataRecords.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">字段</th>
                        <th className="px-4 py-2 text-left">原始值</th>
                        <th className="px-4 py-2 text-left">修正后</th>
                        <th className="px-4 py-2 text-left">原因</th>
                        <th className="px-4 py-2 text-left">来源</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dirtyDataRecords.map((record) => (
                        <tr key={record.id} className="bg-orange-50">
                          <td className="px-4 py-2 font-medium text-gray-800">
                            {record.field}
                          </td>
                          <td className="px-4 py-2 text-red-600 line-through">
                            {String(record.originalValue)}
                          </td>
                          <td className="px-4 py-2 text-green-600 font-medium">
                            {record.correctedValue !== undefined
                              ? String(record.correctedValue)
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {record.reason}
                          </td>
                          <td className="px-4 py-2 text-gray-500 text-xs">
                            {record.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validationErrors.length === 0 && dirtyDataRecords.length === 0 && !hasFeasibilityIssues && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  一切正常！
                </h3>
                <p className="text-gray-600">
                  没有发现验证错误、数据质量问题或可行性问题
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        <button
          onClick={reset}
          className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          🔄 重置计算
        </button>
        <button
          onClick={calculate}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔁 重新计算
        </button>
      </div>
    </div>
  );
};
