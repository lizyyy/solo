import React from 'react';
import { X, RotateCcw, Save } from 'lucide-react';
import type { FittingParams, EnvironmentParams, FilterConditions } from '@/types';
import { thrustUnitLabels } from '@/utils/units';

interface ParameterPanelProps {
  visible: boolean;
  onClose: () => void;
  fittingParams: FittingParams;
  environmentParams: EnvironmentParams;
  filterConditions: FilterConditions;
  onFittingParamsChange: (params: Partial<FittingParams>) => void;
  onEnvironmentParamsChange: (params: Partial<EnvironmentParams>) => void;
  onFilterConditionsChange: (conditions: Partial<FilterConditions>) => void;
  onApply: () => void;
  onReset: () => void;
  onSave: () => void;
  dataPoints?: { rpm: number; voltage: number; propellerDiameter: number }[];
}

const fitTypeOptions = [
  { value: 'linear', label: '线性拟合' },
  { value: 'polynomial', label: '多项式拟合' },
  { value: 'power', label: '幂函数拟合' },
];

const variableOptions = [
  { value: 'rpm', label: '转速 (RPM)' },
  { value: 'voltage', label: '电压 (V)' },
  { value: 'propellerDiameter', label: '桨径 (inch)' },
];

export const ParameterPanel: React.FC<ParameterPanelProps> = ({
  visible,
  onClose,
  fittingParams,
  environmentParams,
  filterConditions,
  onFittingParamsChange,
  onEnvironmentParamsChange,
  onFilterConditionsChange,
  onApply,
  onReset,
  onSave,
  dataPoints = [],
}) => {
  const uniqueDiameters = [...new Set(dataPoints.map(d => d.propellerDiameter))].sort();
  const rpmMin = dataPoints.length > 0 ? Math.min(...dataPoints.map(d => d.rpm)) : 0;
  const rpmMax = dataPoints.length > 0 ? Math.max(...dataPoints.map(d => d.rpm)) : 10000;
  const voltageMin = dataPoints.length > 0 ? Math.min(...dataPoints.map(d => d.voltage)) : 0;
  const voltageMax = dataPoints.length > 0 ? Math.max(...dataPoints.map(d => d.voltage)) : 20;

  if (!visible) return null;

  return (
    <div className="w-80 bg-industrial-900 border-l border-industrial-800 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-800">
        <h2 className="font-display text-sm font-semibold text-gray-100">参数配置</h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-industrial-800 text-gray-400 hover:text-gray-200"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-xs font-mono text-tech-400 uppercase tracking-wider mb-3">筛选条件</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">转速范围 (RPM)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={filterConditions.rpmRange?.[0] ?? ''}
                  onChange={(e) => {
                    const min = e.target.value ? Number(e.target.value) : undefined;
                    const max = filterConditions.rpmRange?.[1];
                    onFilterConditionsChange({ rpmRange: min !== undefined && max !== undefined ? [min, max] : null });
                  }}
                  placeholder={String(rpmMin)}
                  className="flex-1 px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  value={filterConditions.rpmRange?.[1] ?? ''}
                  onChange={(e) => {
                    const min = filterConditions.rpmRange?.[0];
                    const max = e.target.value ? Number(e.target.value) : undefined;
                    onFilterConditionsChange({ rpmRange: min !== undefined && max !== undefined ? [min, max] : null });
                  }}
                  placeholder={String(rpmMax)}
                  className="flex-1 px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">电压范围 (V)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={filterConditions.voltageRange?.[0] ?? ''}
                  onChange={(e) => {
                    const min = e.target.value ? Number(e.target.value) : undefined;
                    const max = filterConditions.voltageRange?.[1];
                    onFilterConditionsChange({ voltageRange: min !== undefined && max !== undefined ? [min, max] : null });
                  }}
                  placeholder={String(voltageMin.toFixed(1))}
                  className="flex-1 px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  step="0.1"
                  value={filterConditions.voltageRange?.[1] ?? ''}
                  onChange={(e) => {
                    const min = filterConditions.voltageRange?.[0];
                    const max = e.target.value ? Number(e.target.value) : undefined;
                    onFilterConditionsChange({ voltageRange: min !== undefined && max !== undefined ? [min, max] : null });
                  }}
                  placeholder={String(voltageMax.toFixed(1))}
                  className="flex-1 px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">固定桨径</label>
              <select
                value={filterConditions.propellerDiameter ?? ''}
                onChange={(e) => {
                  onFilterConditionsChange({
                    propellerDiameter: e.target.value ? Number(e.target.value) : null,
                  });
                }}
                className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
              >
                <option value="">全部桨径</option>
                {uniqueDiameters.map(d => (
                  <option key={d} value={d}>{d} inch</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterConditions.excludeAnomalies}
                onChange={(e) => onFilterConditionsChange({ excludeAnomalies: e.target.checked })}
                className="w-4 h-4 rounded border-industrial-600 bg-industrial-800 text-tech-500 focus:ring-tech-500"
              />
              <span className="text-sm text-gray-300">排除异常数据点</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-mono text-tech-400 uppercase tracking-wider mb-3">拟合参数</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">拟合类型</label>
              <select
                value={fittingParams.fitType}
                onChange={(e) => onFittingParamsChange({ fitType: e.target.value as any })}
                className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
              >
                {fitTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {fittingParams.fitType === 'polynomial' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  多项式次数: {fittingParams.polynomialDegree}
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={fittingParams.polynomialDegree}
                  onChange={(e) => onFittingParamsChange({ polynomialDegree: Number(e.target.value) })}
                  className="w-full accent-tech-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">自变量</label>
              <select
                value={fittingParams.independentVariable}
                onChange={(e) => onFittingParamsChange({ independentVariable: e.target.value as any })}
                className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
              >
                {variableOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">目标推力单位</label>
              <select
                value={fittingParams.thrustUnit}
                onChange={(e) => onFittingParamsChange({ thrustUnit: e.target.value as any })}
                className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
              >
                {Object.entries(thrustUnitLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-mono text-tech-400 uppercase tracking-wider mb-3">异常检测阈值</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                转速采样间隔: {fittingParams.rpmSamplingInterval} RPM
              </label>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={fittingParams.rpmSamplingInterval}
                onChange={(e) => onFittingParamsChange({ rpmSamplingInterval: Number(e.target.value) })}
                className="w-full accent-tech-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                电压骤降阈值: {fittingParams.voltageSagThreshold}%
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={fittingParams.voltageSagThreshold}
                onChange={(e) => onFittingParamsChange({ voltageSagThreshold: Number(e.target.value) })}
                className="w-full accent-tech-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                异常值阈值: {fittingParams.outlierThreshold}σ
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={fittingParams.outlierThreshold}
                onChange={(e) => onFittingParamsChange({ outlierThreshold: Number(e.target.value) })}
                className="w-full accent-tech-500"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-mono text-tech-400 uppercase tracking-wider mb-3">环境参数</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">空气密度 (kg/m³)</label>
              <input
                type="number"
                step="0.001"
                value={environmentParams.airDensity}
                onChange={(e) => onEnvironmentParamsChange({ airDensity: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">温度 (°C)</label>
                <input
                  type="number"
                  value={environmentParams.temperature}
                  onChange={(e) => onEnvironmentParamsChange({ temperature: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">湿度 (%)</label>
                <input
                  type="number"
                  value={environmentParams.humidity}
                  onChange={(e) => onEnvironmentParamsChange({ humidity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">气压 (kPa)</label>
              <input
                type="number"
                step="0.001"
                value={environmentParams.pressure}
                onChange={(e) => onEnvironmentParamsChange({ pressure: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-industrial-800 border border-industrial-700 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-tech-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-industrial-800 space-y-2">
        <button
          onClick={onApply}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors"
        >
          <span className="text-sm font-medium">应用并重新计算</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-industrial-700 hover:bg-industrial-800 text-gray-300 rounded-lg transition-colors"
          >
            <RotateCcw size={14} />
            <span className="text-xs">重置</span>
          </button>
          <button
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-industrial-700 hover:bg-industrial-800 text-gray-300 rounded-lg transition-colors"
          >
            <Save size={14} />
            <span className="text-xs">保存</span>
          </button>
        </div>
      </div>
    </div>
  );
};
