import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTrailStore } from '@/store/useStore'
import type { CrowdingLevel } from '@/types'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLORS: Record<CrowdingLevel, string> = {
  crowded: '#ef4444',
  normal: '#4ecdc4',
  pending_review: '#ff6b35',
}

const STATUS_LABELS: Record<CrowdingLevel, string> = {
  crowded: '拥挤',
  normal: '正常',
  pending_review: '待确认',
}

function FlyToSelectedPoint({ selectedPointId }: { selectedPointId: string | null }) {
  const map = useMap()
  const points = useTrailStore((s) => s.points)
  const prevIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedPointId || selectedPointId === prevIdRef.current) return
    prevIdRef.current = selectedPointId
    const point = points.find((p) => p.id === selectedPointId)
    if (point) {
      map.flyTo([point.latitude, point.longitude], 17, { duration: 0.8 })
    }
  }, [selectedPointId, points, map])

  return null
}

export default function TrailMap() {
  const points = useTrailStore((s) => s.points)
  const statuses = useTrailStore((s) => s.statuses)
  const selectedPointId = useTrailStore((s) => s.selectedPointId)
  const setSelectedPoint = useTrailStore((s) => s.setSelectedPoint)

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[31.2290, 121.4770]}
        zoom={15}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyToSelectedPoint selectedPointId={selectedPointId} />
        {points.map((point) => {
          const status = statuses.find((s) => s.pointId === point.id)
          const level: CrowdingLevel = status?.status ?? 'pending_review'
          const color = STATUS_COLORS[level]
          const isSelected = selectedPointId === point.id

          return (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={isSelected ? 14 : 10}
              pathOptions={{
                color,
                fillColor: color,
                weight: isSelected ? 3 : 2,
                fillOpacity: 0.7,
              }}
              eventHandlers={{
                click: () => setSelectedPoint(point.id),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-base mb-1">{point.name}</div>
                  <div className="mb-2">
                    状态：
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1"
                      style={{ backgroundColor: color }}
                    />
                    {STATUS_LABELS[level]}
                  </div>
                  <button
                    className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                    onClick={() => setSelectedPoint(point.id)}
                  >
                    查看详情
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3 z-[1000]">
        <div className="text-xs font-semibold text-gray-700 mb-2">拥挤状态</div>
        {(Object.keys(STATUS_COLORS) as CrowdingLevel[]).map((level) => (
          <div key={level} className="flex items-center gap-2 text-xs text-gray-600 mb-1 last:mb-0">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLORS[level] }}
            />
            {STATUS_LABELS[level]}
          </div>
        ))}
      </div>
    </div>
  )
}
