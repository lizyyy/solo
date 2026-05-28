import type { InterpolationConfig } from '@/types';

interface InterpolationConfigPanelProps {
  config: InterpolationConfig;
  onChange: (c: Partial<InterpolationConfig>) => void;
}

export default function InterpolationConfigPanel({ config, onChange }: InterpolationConfigPanelProps) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: 'rgba(10,14,39,0.8)',
        border: '1px solid rgba(148,163,184,0.15)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-sm text-[#94a3b8]">插值配置</span>
        <span className="text-[10px] font-mono text-[#00e5c7]">
          {config.method.toUpperCase()} · {config.steps} 步
        </span>
      </div>

      <div className="mb-3">
        <span className="mb-1 block text-[10px] font-mono text-[#94a3b8]/60">插值方法</span>
        <div className="flex gap-1">
          {(['slerp', 'lerp'] as const).map((method) => (
            <button
              key={method}
              onClick={() => onChange({ method })}
              className="flex-1 rounded px-3 py-1.5 text-xs font-mono transition-colors"
              style={{
                backgroundColor:
                  config.method === method ? 'rgba(0,229,199,0.15)' : 'rgba(148,163,184,0.05)',
                color: config.method === method ? '#00e5c7' : '#94a3b8',
                border: `1px solid ${
                  config.method === method ? 'rgba(0,229,199,0.3)' : 'rgba(148,163,184,0.1)'
                }`,
              }}
            >
              {method.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#94a3b8]/60">插值步数</span>
          <span className="text-xs font-mono text-[#e2e8f0]">{config.steps}</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={config.steps}
          onChange={(e) => onChange({ steps: parseInt(e.target.value, 10) })}
          className="h-1 w-full cursor-pointer appearance-none rounded-full"
          style={{
            backgroundColor: 'rgba(148,163,184,0.2)',
            accentColor: '#00e5c7',
          }}
        />
        <div className="mt-0.5 flex justify-between">
          <span className="text-[9px] font-mono text-[#94a3b8]/40">10</span>
          <span className="text-[9px] font-mono text-[#94a3b8]/40">100</span>
        </div>
      </div>
    </div>
  );
}
