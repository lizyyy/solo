import { Panel } from './ui/Panel';
import { Slider } from './ui/Slider';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useBridgeStore } from '@/store/useBridgeStore';
import { cn } from '@/lib/utils';

export function ControlPanel() {
  const modeShape = useBridgeStore(state => state.modeShape);
  const scene = useBridgeStore(state => state.scene);
  const model = useBridgeStore(state => state.model);
  const selectMode = useBridgeStore(state => state.selectMode);
  const togglePlay = useBridgeStore(state => state.togglePlay);
  const setScene = useBridgeStore(state => state.setScene);
  const setFrequencyUnit = useBridgeStore(state => state.setFrequencyUnit);
  
  const currentModeData = model?.modeShapes.find(m => m.order === modeShape.currentOrder);

  const convertFrequency = (freq: number, fromUnit: string, toUnit: string) => {
    if (fromUnit === toUnit) return freq;
    if (fromUnit === 'Hz' && toUnit === 'rad/s') return freq * 2 * Math.PI;
    return freq / (2 * Math.PI);
  };

  return (
    <Panel title="振型控制" className="w-72">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-400">动画控制</span>
            <div className="flex gap-1">
              <button
                onClick={togglePlay}
                className={cn(
                  'p-2 rounded border transition-colors',
                  scene.isPlaying
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                )}
              >
                {scene.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setScene({ isPlaying: false })}
                className="p-2 rounded border border-zinc-600 text-zinc-400 hover:border-zinc-500 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <Slider
            label="动画速度"
            value={scene.animationSpeed}
            min={0.1}
            max={3}
            step={0.1}
            onChange={(v) => setScene({ animationSpeed: v })}
            unit="x"
          />
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-400">振型阶次</span>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setFrequencyUnit('Hz')}
                className={cn(
                  'px-2 py-1 rounded border transition-colors',
                  modeShape.frequencyUnit === 'Hz'
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-zinc-600 text-zinc-400'
                )}
              >
                Hz
              </button>
              <button
                onClick={() => setFrequencyUnit('rad/s')}
                className={cn(
                  'px-2 py-1 rounded border transition-colors',
                  modeShape.frequencyUnit === 'rad/s'
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-zinc-600 text-zinc-400'
                )}
              >
                rad/s
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-4">
            {modeShape.availableModes.map(order => (
              <button
                key={order}
                onClick={() => selectMode(order)}
                className={cn(
                  'py-2 rounded border text-sm font-mono transition-colors',
                  modeShape.currentOrder === order
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                )}
              >
                {order}
              </button>
            ))}
          </div>
          
          {currentModeData && (
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <div className="text-xs text-zinc-500 mb-1">第{modeShape.currentOrder}阶频率</div>
              <div className="text-xl font-mono text-blue-400">
                {convertFrequency(
                  currentModeData.frequency,
                  currentModeData.frequencyUnit,
                  modeShape.frequencyUnit
                ).toFixed(2)}
                <span className="text-sm text-zinc-500 ml-1">{modeShape.frequencyUnit}</span>
              </div>
            </div>
          )}
        </div>
        
        <div>
          <span className="text-xs text-zinc-400 block mb-3">变形放大系数</span>
          <Slider
            value={scene.deformationScale}
            min={1}
            max={20}
            step={1}
            onChange={(v) => setScene({ deformationScale: v })}
            unit="x"
          />
        </div>
      </div>
    </Panel>
  );
}
