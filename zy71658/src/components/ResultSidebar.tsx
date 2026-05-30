
import type { LaunchWindowResult } from '../types';

interface ResultSidebarProps {
  result: LaunchWindowResult | null;
}

export function ResultSidebar({ result }: ResultSidebarProps) {
  if (!result) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 h-full">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          检测结果
        </h2>
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <span className="text-4xl mb-4">🔍</span>
          <p>请填写实验参数</p>
          <p className="text-sm">系统将实时分析升空可行性</p>
        </div>
      </div>
    );
  }

  const statusConfig = {
    safe: { color: 'bg-green-100 text-green-800 border-green-300', icon: '✅', label: '安全升空' },
    warning: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⚠️', label: '谨慎操作' },
    danger: { color: 'bg-red-100 text-red-800 border-red-300', icon: '🚫', label: '禁止升空' },
    unknown: { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '❓', label: '数据不足' },
  };

  const status = statusConfig[result.status];

  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-full">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        检测结果
      </h2>

      <div className={`p-4 rounded-lg border-2 mb-6 ${status.color}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{status.icon}</span>
          <div>
            <div className="font-bold text-lg">{status.label}</div>
            <div className="text-sm opacity-80">
              {result.canLaunch ? '满足升空条件' : '存在安全问题'}
            </div>
          </div>
        </div>
      </div>

      {result.buoyancy && (
        <div className="mb-6">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span>🔬</span> 浮力计算
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">浮力</span>
              <span className="font-medium">{result.buoyancy.buoyantForce.toFixed(1)} N</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">净升力</span>
              <span className={`font-medium ${result.buoyancy.netLift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.buoyancy.netLift.toFixed(1)} N
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">空气密度</span>
              <span className="font-medium">{result.buoyancy.airDensity.toFixed(3)} kg/m³</span>
            </div>
          </div>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-red-700 mb-3 flex items-center gap-2">
            <span>❌</span> 问题清单
          </h3>
          <div className="space-y-2">
            {result.errors.map((error, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-xs text-red-500 font-medium mb-1">
                  步骤：{error.step}
                </div>
                <div className="text-sm text-red-800 font-medium">
                  {error.message}
                </div>
                {error.actualValue && (
                  <div className="text-xs text-red-600 mt-1">
                    实际值：{error.actualValue}
                    {error.expectedRange && ` | 要求：${error.expectedRange}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-yellow-700 mb-3 flex items-center gap-2">
            <span>⚠️</span> 注意事项
          </h3>
          <div className="space-y-2">
            {result.warnings.map((warning, index) => (
              <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-xs text-yellow-600 font-medium mb-1">
                  步骤：{warning.step}
                </div>
                <div className="text-sm text-yellow-800">
                  {warning.message}
                </div>
                {warning.actualValue && (
                  <div className="text-xs text-yellow-600 mt-1">
                    当前值：{warning.actualValue}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div>
          <h3 className="font-medium text-blue-700 mb-3 flex items-center gap-2">
            <span>💡</span> 操作建议
          </h3>
          <ul className="space-y-2">
            {result.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-blue-500 mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
        检测时间：{result.timestamp.toLocaleString('zh-CN')}
      </div>
    </div>
  );
}
