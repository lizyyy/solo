import { FREQUENCY_BANDS, type FrequencyBand } from '@/types'
import useSceneStore from '@/stores/sceneStore'

export default function FrequencyBandBar() {
  const currentBand = useSceneStore((state) => state.currentBand)
  const setCurrentBand = useSceneStore((state) => state.setCurrentBand)

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-theater-panel/80 border-b border-theater-border">
      <span className="font-display text-sm text-gray-400">频段</span>
      <div className="flex gap-1.5 flex-wrap">
        {FREQUENCY_BANDS.map((band: FrequencyBand) => (
          <button
            key={band}
            onClick={() => setCurrentBand(band)}
            className={`px-2 py-0.5 rounded font-mono text-xs transition-colors ${
              currentBand === band
                ? 'bg-theater-accent text-white'
                : 'bg-theater-panel text-gray-400 hover:text-white hover:bg-theater-border'
            }`}
          >
            {band}
          </button>
        ))}
      </div>
    </div>
  )
}
