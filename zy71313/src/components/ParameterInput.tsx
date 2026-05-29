import { ChevronDown } from 'lucide-react';
import { useFlowStore } from '@/store/useFlowStore';

interface ParameterFieldProps<T extends string> {
  label: string;
  symbol: string;
  value: number | null;
  unit: T;
  units: T[];
  onChange: (value: number | null, unit?: T) => void;
  anomaly?: boolean;
  placeholder?: string;
}

function ParameterField<T extends string>({
  label,
  symbol,
  value,
  unit,
  units,
  onChange,
  anomaly,
  placeholder = '请输入',
}: ParameterFieldProps<T>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700">
          {label} <span className="text-teal-700 font-mono">({symbol})</span>
        </label>
        {anomaly && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            异常
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={placeholder}
          step="any"
          className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all outline-none
            ${anomaly
              ? 'border-orange-300 bg-orange-50 focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
              : 'border-zinc-200 bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-50'}
          `}
        />
        <div className="relative">
          <select
            value={unit}
            onChange={(e) => onChange(value, e.target.value as T)}
            className="appearance-none px-3 py-2 pr-8 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-700 focus:border-teal-600 focus:ring-2 focus:ring-teal-50 outline-none cursor-pointer"
          >
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

export default function ParameterInput() {
  const {
    pipeDiameter,
    velocity,
    density,
    viscosity,
    temperature,
    setPipeDiameter,
    setVelocity,
    setDensity,
    setViscosity,
    setTemperature,
    calculateRe,
    clearAll,
    result,
    currentSampleName,
  } = useFlowStore();

  const viscosityAnomaly = result?.anomalies.some(a => a.type === 'viscosity_unit_mismatch') ?? false;
  const temperatureAnomaly = result?.anomalies.some(a => a.type === 'temperature_missing') ?? false;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-800" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
            参数输入
          </h2>
          {currentSampleName && (
            <p className="text-xs text-teal-600 mt-1">
              当前样例：{currentSampleName}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearAll}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            清空
          </button>
          <button
            onClick={calculateRe}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-sm hover:shadow"
          >
            计算雷诺数
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ParameterField
          label="管径"
          symbol="d"
          value={pipeDiameter.value}
          unit={pipeDiameter.unit}
          units={['mm', 'm']}
          onChange={setPipeDiameter}
          placeholder="如 25"
        />
        <ParameterField
          label="流速"
          symbol="v"
          value={velocity.value}
          unit={velocity.unit}
          units={['m/s']}
          onChange={setVelocity}
          placeholder="如 2"
        />
        <ParameterField
          label="密度"
          symbol="ρ"
          value={density.value}
          unit={density.unit}
          units={['kg/m³']}
          onChange={setDensity}
          placeholder="如 998"
        />
        <ParameterField
          label="黏度"
          symbol="μ"
          value={viscosity.value}
          unit={viscosity.unit}
          units={['Pa·s', 'mPa·s']}
          onChange={setViscosity}
          anomaly={viscosityAnomaly}
          placeholder="如 1.002"
        />
        <ParameterField
          label="温度"
          symbol="T"
          value={temperature.value}
          unit={temperature.unit}
          units={['℃']}
          onChange={setTemperature}
          anomaly={temperatureAnomaly}
          placeholder="可选，如 20"
        />
      </div>

      <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
        <p className="text-xs text-teal-700">
          <span className="font-medium">公式：</span>
          <span className="font-mono">Re = ρ · v · d / μ</span>
          <span className="text-teal-500 ml-2">其中 ρ 为密度，v 为流速，d 为管径，μ 为黏度</span>
        </p>
      </div>
    </div>
  );
}
