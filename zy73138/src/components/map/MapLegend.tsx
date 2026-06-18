export default function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] rounded-lg border border-tide/30 bg-ocean-900/90 px-4 py-3 backdrop-blur-sm">
      <h4 className="mb-2 font-serif text-xs font-semibold tracking-wide text-tide">
        图例
      </h4>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full border-2 border-tide bg-tide opacity-70"
          />
          <span className="text-xs text-foam/80">正常记录</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="anomaly-marker inline-block h-3.5 w-3.5 rounded-full border-2 border-rust bg-rust opacity-80" />
          <span className="text-xs text-foam/80">异常记录</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="review-marker inline-block h-3.5 w-3.5 rounded-full border-2 border-sand bg-sand opacity-80" />
          <span className="text-xs text-foam/80">待复核</span>
        </div>
      </div>
    </div>
  )
}
