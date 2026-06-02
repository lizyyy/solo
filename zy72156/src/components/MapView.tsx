import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Location } from '../types'
import { MapPin as MapPinIcon, AlertTriangle, CheckCircle } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'

interface MapViewProps {
  locations: Location[]
  onLocationClick?: (id: string) => void
  height?: string
}

function createCustomIcon(hasDrift: boolean) {
  const iconSvg = renderToStaticMarkup(
    <div
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        backgroundColor: hasDrift ? '#f6ad55' : '#4a5568',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        border: '2px solid white',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </div>
  )

  return L.divIcon({
    html: iconSvg,
    className: 'custom-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export function MapView({ locations, onLocationClick, height = '100%' }: MapViewProps) {
  const [center] = useState<[number, number]>([30.6, 104.05])

  return (
    <div className="relative" style={{ height }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={createCustomIcon(loc.has_coordinate_drift)}
            eventHandlers={{
              click: () => onLocationClick?.(loc.id),
            }}
          >
            <Popup>
              <div className="p-1">
                <h4 className="font-semibold text-primary-800">{loc.canonical_name}</h4>
                {loc.aliases.length > 0 && (
                  <p className="text-xs text-primary-500 mt-1">
                    别名：{loc.aliases.slice(0, 2).join('、')}
                    {loc.aliases.length > 2 && ` 等${loc.aliases.length}个`}
                  </p>
                )}
                {loc.has_coordinate_drift && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-orange-600">
                    <AlertTriangle size={12} />
                    <span>坐标偏移</span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
