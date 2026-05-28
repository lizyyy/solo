import { useStore } from '@/store/useStore'

export default function SectionSlider() {
  const { sectionPlaneY, setSectionPlaneY } = useStore()

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
      <div className="bg-dc-panel rounded-lg border border-dc-border px-6 py-3 flex items-center gap-4">
        <span className="text-sm text-dc-muted whitespace-nowrap">剖面高度</span>
        <input
          type="range"
          min={0}
          max={6}
          step={0.1}
          value={sectionPlaneY}
          onChange={(e) => setSectionPlaneY(parseFloat(e.target.value))}
          className="w-64 h-2 bg-dc-bg rounded-lg appearance-none cursor-pointer accent-dc-cold"
        />
        <span className="text-sm font-mono text-dc-text w-12 text-right">
          {sectionPlaneY.toFixed(1)}m
        </span>
      </div>
    </div>
  )
}
