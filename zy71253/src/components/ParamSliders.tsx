import { useStore } from '@/store/useStore';
import type { SystemParams } from '@/utils/mathEngine';

const PARAM_CONFIG: { key: keyof SystemParams; label: string; min: number; max: number; step: number; color: string }[] = [
  { key: 'a', label: 'a', min: -5, max: 5, step: 0.1, color: '#FF6B4A' },
  { key: 'b', label: 'b', min: -5, max: 5, step: 0.1, color: '#00D4AA' },
  { key: 'c', label: 'c', min: -5, max: 5, step: 0.1, color: '#FFB84D' },
  { key: 'd', label: 'd', min: -5, max: 5, step: 0.1, color: '#AABBFF' },
];

const PRESETS: { name: string; params: SystemParams }[] = [
  { name: '稳定结点', params: { a: -2, b: 0, c: 0, d: -1 } },
  { name: '鞍点', params: { a: 1, b: 0, c: 0, d: -1 } },
  { name: '稳定焦点', params: { a: -1, b: 2, c: -2, d: -1 } },
  { name: '中心', params: { a: 0, b: 1, c: -1, d: 0 } },
  { name: '不稳定焦点', params: { a: 1, b: 2, c: -2, d: 1 } },
  { name: '不稳定结点', params: { a: 2, b: 0, c: 0, d: 1 } },
];

export default function ParamSliders() {
  const params = useStore((s) => s.params);
  const setParam = useStore((s) => s.setParam);
  const ic = useStore((s) => s.initialCondition);
  const setIC = useStore((s) => s.setInitialCondition);
  const simConfig = useStore((s) => s.simConfig);
  const setSimConfig = useStore((s) => s.setSimConfig);

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#0d1b2e]/80 backdrop-blur-sm rounded-xl border border-[#1a3050]/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#aabbcc] tracking-wider uppercase"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          系统参数
        </h3>
      </div>

      <div className="text-xs text-[#667788] mb-1"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        dx/dt = ax + by &nbsp;|&nbsp; dy/dt = cx + dy
      </div>

      {PARAM_CONFIG.map((cfg) => (
        <div key={cfg.key} className="flex items-center gap-3">
          <span
            className="text-xs font-bold w-4 text-right"
            style={{ color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}
          >
            {cfg.label}
          </span>
          <input
            type="range"
            min={cfg.min}
            max={cfg.max}
            step={cfg.step}
            value={params[cfg.key]}
            onChange={(e) => setParam(cfg.key, parseFloat(e.target.value))}
            className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${cfg.color}30, ${cfg.color})`,
              accentColor: cfg.color,
            }}
          />
          <span
            className="text-xs w-10 text-right tabular-nums"
            style={{ color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}
          >
            {params[cfg.key].toFixed(1)}
          </span>
        </div>
      ))}

      <div className="border-t border-[#1a3050] pt-3 mt-1">
        <h4 className="text-xs font-semibold text-[#8899aa] mb-2 uppercase tracking-wider"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          初值设定
        </h4>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-[#FFB84D]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>x₀</span>
            <input
              type="number"
              value={ic.x0}
              step={0.5}
              onChange={(e) => setIC(parseFloat(e.target.value) || 0, ic.y0)}
              className="flex-1 bg-[#0a1628] border border-[#1a3050] rounded-md px-2 py-1 text-xs text-[#aabbcc] w-full"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-[#00D4AA]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>y₀</span>
            <input
              type="number"
              value={ic.y0}
              step={0.5}
              onChange={(e) => setIC(ic.x0, parseFloat(e.target.value) || 0)}
              className="flex-1 bg-[#0a1628] border border-[#1a3050] rounded-md px-2 py-1 text-xs text-[#aabbcc] w-full"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-[#1a3050] pt-3 mt-1">
        <h4 className="text-xs font-semibold text-[#8899aa] mb-2 uppercase tracking-wider"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          积分设置
        </h4>
        <div className="flex gap-3 items-center">
          <select
            value={simConfig.method}
            onChange={(e) => setSimConfig({ method: e.target.value as 'euler' | 'rk4' })}
            className="bg-[#0a1628] border border-[#1a3050] rounded-md px-2 py-1 text-xs text-[#aabbcc]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            <option value="rk4">RK4</option>
            <option value="euler">Euler</option>
          </select>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-[#667788]">步长</span>
            <input
              type="number"
              value={simConfig.dt}
              step={0.01}
              min={0.001}
              max={1}
              onChange={(e) => setSimConfig({ dt: parseFloat(e.target.value) || 0.05 })}
              className="flex-1 bg-[#0a1628] border border-[#1a3050] rounded-md px-2 py-1 text-xs text-[#aabbcc]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-[#667788]">T<sub>max</sub></span>
            <input
              type="number"
              value={simConfig.tMax}
              step={1}
              min={1}
              max={100}
              onChange={(e) => setSimConfig({ tMax: parseFloat(e.target.value) || 20 })}
              className="flex-1 bg-[#0a1628] border border-[#1a3050] rounded-md px-2 py-1 text-xs text-[#aabbcc]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
        </div>
        {simConfig.dt > 0.2 && (
          <div className="mt-2 text-xs text-[#FFB84D] flex items-center gap-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            ⚠ 步长偏大，轨迹可能失真
          </div>
        )}
      </div>

      <div className="border-t border-[#1a3050] pt-3 mt-1">
        <h4 className="text-xs font-semibold text-[#8899aa] mb-2 uppercase tracking-wider"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          参数预设
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                Object.entries(preset.params).forEach(([k, v]) => {
                  setParam(k as keyof SystemParams, v);
                });
              }}
              className="px-2 py-1 text-xs rounded-full border border-[#1a3050] bg-[#0a1628] text-[#8899aa] hover:text-[#FF6B4A] hover:border-[#FF6B4A]/40 transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
