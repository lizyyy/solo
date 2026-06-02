import { useState } from "react"
import { Camera, X } from "lucide-react"

export default function PhotoSection({ urls, isOldCaliber }: { urls: string[]; isOldCaliber: boolean }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  if (urls.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Camera size={16} className="text-[#4a90d9]" />
        <h3 className="text-sm font-medium text-white">巡检照片</h3>
        <span className="text-xs text-gray-500">({urls.length})</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {urls.map((url, i) => (
          <div
            key={i}
            onClick={() => setLightboxIdx(i)}
            className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-transform hover:scale-[1.02] ${
              isOldCaliber ? "border-[#eab308]" : "border-white/10"
            }`}
          >
            <img src={url} alt={`巡检照片 ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            {isOldCaliber && (
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-[#eab308]/90 text-[#0f0f1a] font-medium">
                旧口径补录
              </span>
            )}
          </div>
        ))}
      </div>

      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setLightboxIdx(null)}
          >
            <X size={28} />
          </button>
          <img
            src={urls[lightboxIdx]}
            alt={`巡检照片 ${lightboxIdx + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
