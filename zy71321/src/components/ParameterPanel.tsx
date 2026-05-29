import { useSimulationStore } from '../store/simulationStore';
import { PARAM_RANGES } from '../types';
import { formatNumber } from '../utils/calculator';

interface SliderProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, unit, min, max, step, onChange }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-mono text-primary-800 bg-primary-50 px-2 py-0.5 rounded">
          {formatNumber(value, step < 1 ? (step < 0.01 ? 3 : 2) : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between mt-1 text-xs text-slate-400 font-mono">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function ParameterPanel() {
  const { params, setParams, toggleDirection, isPlaying, togglePlaying } = useSimulationStore((state) => ({
    params: state.session.params,
    setParams: state.setParams,
    toggleDirection: state.toggleDirection,
    isPlaying: state.isPlaying,
    togglePlaying: state.togglePlaying,
  }));

  return (
    <div className="bg-white rounded-lg card-shadow p-5 h-full overflow-y-auto">
      <h2 className="font-serif-sc text-lg font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-200">
        参数控制
      </h2>

      <div className="flex gap-2 mb-5">
        <button
          onClick={togglePlaying}
          className={`flex-1 py-2 px-4 rounded font-medium text-sm btn-hover ${
            isPlaying
              ? 'bg-danger-500 text-white hover:bg-danger-600'
              : 'bg-success-500 text-white hover:bg-success-600'
          }`}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button
          onClick={toggleDirection}
          className={`flex-1 py-2 px-4 rounded font-medium text-sm btn-hover ${
            params.direction === 1
              ? 'bg-primary-700 text-white hover:bg-primary-800'
              : 'bg-warning-500 text-white hover:bg-warning-600'
          }`}
        >
          {params.direction === 1 ? '→ 正向' : '← 反向'}
        </button>
      </div>

      <Slider
        label="线圈匝数 N"
        value={params.turns}
        unit="匝"
        min={PARAM_RANGES.turns.min}
        max={PARAM_RANGES.turns.max}
        step={PARAM_RANGES.turns.step}
        onChange={(v) => setParams({ turns: v })}
      />

      <Slider
        label="磁场强度 B"
        value={params.fieldStrength}
        unit="T"
        min={PARAM_RANGES.fieldStrength.min}
        max={PARAM_RANGES.fieldStrength.max}
        step={PARAM_RANGES.fieldStrength.step}
        onChange={(v) => setParams({ fieldStrength: v })}
      />

      <Slider
        label="运动速度 v"
        value={params.velocity}
        unit="m/s"
        min={PARAM_RANGES.velocity.min}
        max={PARAM_RANGES.velocity.max}
        step={PARAM_RANGES.velocity.step}
        onChange={(v) => setParams({ velocity: v })}
      />

      <Slider
        label="线圈面积 A"
        value={params.area}
        unit="m²"
        min={PARAM_RANGES.area.min}
        max={PARAM_RANGES.area.max}
        step={PARAM_RANGES.area.step}
        onChange={(v) => setParams({ area: v })}
      />

      <Slider
        label="采样点数"
        value={params.samplePoints}
        unit="点"
        min={PARAM_RANGES.samplePoints.min}
        max={PARAM_RANGES.samplePoints.max}
        step={PARAM_RANGES.samplePoints.step}
        onChange={(v) => setParams({ samplePoints: v })}
      />

      <div className="mt-6 pt-4 border-t border-slate-200">
        <h3 className="text-sm font-medium text-slate-600 mb-2">快捷预设</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setParams({ turns: 50, fieldStrength: 0.3, velocity: 1.0, area: 0.005 })}
            className="py-1.5 px-3 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-700 btn-hover"
          >
            弱磁低速
          </button>
          <button
            onClick={() => setParams({ turns: 200, fieldStrength: 0.8, velocity: 5.0, area: 0.02 })}
            className="py-1.5 px-3 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-700 btn-hover"
          >
            强磁高速
          </button>
        </div>
      </div>
    </div>
  );
}
