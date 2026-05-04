import React from 'react';
import { 
  PhysicsParameter, 
  PhysicsProblemType,
  ValidationError
} from '../../../shared/types';
import { AlertTriangle, Info } from 'lucide-react';

interface ParameterPanelProps {
  problemType: PhysicsProblemType;
  typeLabel: string;
  parameters: PhysicsParameter[];
  validationErrors: ValidationError[];
  onParameterChange: (name: string, value: number, unit?: string) => void;
  onSolve: () => void;
  onReset: () => void;
  isSolving: boolean;
  canSolve: boolean;
}

const ParameterPanel: React.FC<ParameterPanelProps> = ({
  problemType,
  typeLabel,
  parameters,
  validationErrors,
  onParameterChange,
  onSolve,
  onReset,
  isSolving,
  canSolve,
}) => {
  const getFieldError = (name: string): ValidationError | undefined => {
    return validationErrors.find(e => e.field === name);
  };

  const getTypeIcon = () => {
    switch (problemType) {
      case 'incline': return '📐';
      case 'projectile': return '🎯';
      case 'spring': return '🔩';
      default: return '⚛️';
    }
  };

  const getTypeDescription = () => {
    switch (problemType) {
      case 'incline':
        return '滑块沿斜面运动的物理问题，支持有摩擦和无摩擦两种情况。';
      case 'projectile':
        return '物体在重力场中的抛射运动，支持从地面或高台发射。';
      case 'spring':
        return '弹簧-质量系统的简谐运动，支持有阻尼和无阻尼振动。';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6 border border-blue-500/20">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{getTypeIcon()}</span>
          <div>
            <h2 className="text-xl font-bold text-white">{typeLabel}</h2>
            <p className="text-gray-400 text-sm">{getTypeDescription()}</p>
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-semibold">参数验证错误</span>
          </div>
          <ul className="space-y-2">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-sm text-red-300 flex items-start gap-2">
                <span className="text-red-400">•</span>
                <span>{error.message}</span>
                {error.value !== undefined && (
                  <span className="text-red-400/70">
                    (当前值: {error.value})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-500 rounded"></div>
          参数设置
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {parameters.map((param) => {
            const error = getFieldError(param.name);
            const isBooleanParam = param.name === 'hasFriction' || param.name === 'hasDamping';

            return (
              <div
                key={param.name}
                className={`bg-gray-800 rounded-xl p-4 border-2 transition-colors ${
                  error ? 'border-red-500/50' : 'border-transparent hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <label className="text-white font-medium block">
                      {param.label}
                    </label>
                    {param.description && (
                      <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {param.description}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {param.name}
                  </div>
                </div>

                {isBooleanParam ? (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => onParameterChange(param.name, 1)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        param.value > 0
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      是
                    </button>
                    <button
                      type="button"
                      onClick={() => onParameterChange(param.name, 0)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        param.value <= 0
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      否
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={param.value}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          onParameterChange(param.name, val);
                        } else if (e.target.value === '') {
                          onParameterChange(param.name, 0);
                        }
                      }}
                      step="any"
                      className={`flex-1 bg-gray-700 border-2 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none transition-all ${
                        error
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-transparent focus:border-blue-500'
                      }`}
                      placeholder="输入数值"
                    />
                    {param.unit && (
                      <div className="bg-gray-700 rounded-lg px-4 py-2.5 text-blue-400 font-mono text-sm min-w-[80px] text-center">
                        {param.unit || '-'}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {error.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700">
        <div className="flex gap-3">
          <button
            onClick={onSolve}
            disabled={!canSolve || isSolving}
            className={`flex-1 py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
              canSolve && !isSolving
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 active:scale-98'
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            {isSolving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                求解中...
              </>
            ) : (
              <>
                <span className="text-lg">⚡</span>
                开始求解
              </>
            )}
          </button>

          <button
            onClick={onReset}
            className="px-6 py-3.5 rounded-xl font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition-all"
          >
            重置
          </button>
        </div>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-300 font-medium mb-1">使用提示</p>
            <ul className="text-gray-400 space-y-1">
              <li>• 所有参数会自动转换为国际单位制（SI）</li>
              <li>• 点击「开始求解」后会显示详细推导过程</li>
              <li>• 求解后可以查看动画演示和运动图表</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParameterPanel;
