import { useScreeningStore } from '@/store/screeningStore'
import { WeightConfig } from '@/types'

const SLIDERS: { key: keyof WeightConfig; label: string; from: string; to: string }[] = [
  { key: 'lowWeight', label: '低频 125/250Hz', from: '#f59e0b', to: '#ea580c' },
  { key: 'midWeight', label: '中频 500/1kHz', from: '#22c55e', to: '#14b8a6' },
  { key: 'highWeight', label: '高频 2/4kHz', from: '#3b82f6', to: '#22d3ee' },
]

export default function WeightSliders() {
  const { weightConfig, setWeightConfig } = useScreeningStore()

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#1a2f2a' }}>
      <h3 className="text-amber-400 text-sm font-semibold mb-4 text-center">频率权重配置</h3>
      <div className="flex justify-around items-start gap-2">
        {SLIDERS.map((s) => (
          <div key={s.key} className="flex flex-col items-center gap-2">
            <div className="h-40 w-8 flex items-center justify-center overflow-visible">
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={weightConfig[s.key]}
                onChange={(e) => setWeightConfig({ [s.key]: parseFloat(e.target.value) })}
                className="w-36 origin-center -rotate-90 cursor-pointer appearance-none rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-1"
                style={{
                  background: `linear-gradient(to right, ${s.from}, ${s.to})`,
                }}
              />
            </div>
            <span className="text-xl font-bold text-amber-300">{weightConfig[s.key].toFixed(1)}</span>
            <span className="text-xs text-gray-400 text-center leading-tight">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
