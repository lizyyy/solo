export default function HeatmapLegend() {
  return (
    <div className="absolute bottom-24 left-4 z-10 glass-panel p-2 rounded-lg">
      <div className="text-xs text-gray-400 mb-2 font-display">声压级 (dB SPL)</div>
      <div className="flex gap-2">
        <div className="heatmap-gradient w-[14px] h-[200px] rounded-sm" />
        <div className="relative w-10 h-[200px]">
          <div className="absolute bottom-0 text-xs font-mono text-gray-400">45</div>
          <div className="absolute top-[75%] -translate-y-1/2 text-xs font-mono text-gray-400">60</div>
          <div className="absolute top-1/2 -translate-y-1/2 text-xs font-mono text-gray-400">75</div>
          <div className="absolute top-[25%] -translate-y-1/2 text-xs font-mono text-gray-400">90</div>
          <div className="absolute top-0 text-xs font-mono text-gray-400">105</div>
        </div>
      </div>
    </div>
  )
}
