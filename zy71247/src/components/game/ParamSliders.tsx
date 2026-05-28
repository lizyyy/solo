import { useGameStore } from '../../store/gameStore';
import { Settings, Radio, Waves, Plane } from 'lucide-react';

export function ParamSliders() {
  const { params, updateParams, getCurrentScene } = useGameStore();
  const scene = getCurrentScene();

  const isSamplingWarning = scene && params.sampling.interval > scene.thresholds.sampling.warning;
  const isNoiseWarning = scene && params.noise.level > scene.thresholds.noise.warning;

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-4 h-4 text-tech-400" />
        <h3 className="font-orbitron text-tech-400 text-sm font-semibold">参数控制</h3>
      </div>

      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-tech-300" />
              <label className="text-sm text-space-200">航迹弯曲度</label>
            </div>
            <span className="text-sm font-mono text-tech-400">{params.flightPath.curvature.toFixed(0)}</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            value={params.flightPath.curvature}
            onChange={(e) => updateParams({
              flightPath: { ...params.flightPath, curvature: Number(e.target.value) }
            })}
            className="w-full h-2 bg-space-700 rounded-lg appearance-none cursor-pointer accent-tech-400"
          />
          <div className="flex justify-between text-xs text-space-500 mt-1">
            <span>-50</span>
            <span>0</span>
            <span>+50</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${isSamplingWarning ? 'text-alert-yellow' : 'text-tech-300'}`} />
              <label className="text-sm text-space-200">采样间隔</label>
            </div>
            <span className={`text-sm font-mono ${isSamplingWarning ? 'text-alert-yellow' : 'text-tech-400'}`}>
              {params.sampling.interval} ms
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={params.sampling.interval}
            onChange={(e) => updateParams({
              sampling: { ...params.sampling, interval: Number(e.target.value) }
            })}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isSamplingWarning ? 'accent-alert-yellow' : 'accent-tech-400'}`}
            style={{ background: isSamplingWarning ? undefined : undefined }}
          />
          <div className="flex justify-between text-xs text-space-500 mt-1">
            <span>1ms</span>
            <span>理想: {scene?.idealParams.samplingInterval}ms</span>
            <span>20ms</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-tech-300" />
              <label className="text-sm text-space-200">采样点数</label>
            </div>
            <span className="text-sm font-mono text-tech-400">{params.sampling.count}</span>
          </div>
          <input
            type="range"
            min="16"
            max="128"
            step="16"
            value={params.sampling.count}
            onChange={(e) => updateParams({
              sampling: { ...params.sampling, count: Number(e.target.value) }
            })}
            className="w-full h-2 bg-space-700 rounded-lg appearance-none cursor-pointer accent-tech-400"
          />
          <div className="flex justify-between text-xs text-space-500 mt-1">
            <span>16</span>
            <span>64</span>
            <span>128</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Waves className={`w-4 h-4 ${isNoiseWarning ? 'text-alert-red' : 'text-tech-300'}`} />
              <label className="text-sm text-space-200">噪声水平</label>
            </div>
            <span className={`text-sm font-mono ${isNoiseWarning ? 'text-alert-red' : 'text-tech-400'}`}>
              {params.noise.level}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={params.noise.level}
            onChange={(e) => updateParams({
              noise: { ...params.noise, level: Number(e.target.value) }
            })}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isNoiseWarning ? 'accent-alert-red' : 'accent-tech-400'}`}
          />
          <div className="flex justify-between text-xs text-space-500 mt-1">
            <span>0%</span>
            <span>阈值: {scene?.thresholds.noise.warning}%</span>
            <span>100%</span>
          </div>
        </div>

        <div>
          <label className="text-sm text-space-200 mb-2 block">噪声类型</label>
          <div className="grid grid-cols-3 gap-2">
            {(['gaussian', 'speckle', 'impulse'] as const).map((type) => (
              <button
                key={type}
                onClick={() => updateParams({ noise: { ...params.noise, type } })}
                className={`px-3 py-2 text-xs rounded border transition-all ${
                  params.noise.type === type
                    ? 'bg-tech-500/20 border-tech-400 text-tech-400'
                    : 'bg-space-700/50 border-space-600 text-space-300 hover:border-space-500'
                }`}
              >
                {type === 'gaussian' ? '高斯' : type === 'speckle' ? '斑点' : '脉冲'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
