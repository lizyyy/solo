import { useStore } from "@/store/useStore"
import { X, ZoomIn, ExternalLink } from "lucide-react"
import { ANOMALY_LABELS } from "@/types"
import { useMemo } from "react"

export default function PhotoGrid({ routeId }: { routeId: string }) {
  const allPhotos = useStore((s) => s.photos)
  const photos = useMemo(() => allPhotos.filter((p) => p.routeId === routeId), [allPhotos, routeId])
  const lightboxPhotoId = useStore((s) => s.lightboxPhotoId)
  const openLightbox = useStore((s) => s.openLightbox)

  const lightboxPhoto = photos.find((p) => p.id === lightboxPhotoId)

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        暂无巡检照片
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => openLightbox(photo.id)}
            className={`animate-slide-up stagger-${Math.min(i + 1, 6)} group relative aspect-[4/3] rounded-lg overflow-hidden border transition-all duration-300 hover:scale-[1.03] ${
              photo.anomalyType
                ? "border-accent-amber/40 ring-1 ring-accent-amber/20"
                : "border-surface-500/20"
            }`}
          >
            <img
              src={photo.url}
              alt={photo.linkedConclusion}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
              <p className="text-[10px] text-white font-medium truncate">{photo.linkedConclusion}</p>
              <p className="text-[9px] text-slate-300 font-mono">{photo.timestamp.replace("T", " ").slice(0, 16)}</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn size={14} className="text-white drop-shadow" />
            </div>
            {photo.anomalyType && (
              <div className="absolute top-2 left-2">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent-amber/90 text-black">
                  {ANOMALY_LABELS[photo.anomalyType]}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => openLightbox(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.linkedConclusion}
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">{lightboxPhoto.linkedConclusion}</h4>
                  <p className="text-xs text-slate-300 font-mono mt-1">{lightboxPhoto.exifData}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{lightboxPhoto.timestamp.replace("T", " ").slice(0, 16)}</p>
                </div>
                {lightboxPhoto.anomalyType && (
                  <span className="px-2 py-1 rounded text-xs bg-accent-amber/20 text-accent-amber border border-accent-amber/30 flex items-center gap-1">
                    <ExternalLink size={12} />
                    {ANOMALY_LABELS[lightboxPhoto.anomalyType]}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => openLightbox(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
