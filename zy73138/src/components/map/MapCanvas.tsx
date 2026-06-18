import 'leaflet/dist/leaflet.css'
import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useWaterQualityStore } from '@/store'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'

function FlyToSelected({ selectedId }: { selectedId: string | null }) {
  const map = useMap()
  const records = useWaterQualityStore((s) => s.records)

  const target = selectedId ? records.find((r) => r.id === selectedId) : null

  if (target) {
    map.flyTo([target.latitude, target.longitude], 15, { duration: 0.8 })
  }

  return null
}

function RecordMarker({ record, hasReview }: {
  record: ReturnType<typeof useWaterQualityStore.getState>['records'][number]
  hasReview: boolean
}) {
  const setSelectedRecord = useWaterQualityStore((s) => s.setSelectedRecord)

  const icon = useMemo(() => {
    let size = 8
    let fillColor = '#00BFA5'
    let cssClass = ''

    if (hasReview) {
      size = 10
      fillColor = '#D4A843'
      cssClass = 'review-marker'
    } else if (record.isAnomaly) {
      size = 10
      fillColor = '#E8653A'
      cssClass = 'anomaly-marker'
    }

    const diameter = size * 2
    const html = `<div class="${cssClass}" style="
      width:${diameter}px;height:${diameter}px;
      background:${fillColor};border-radius:50%;
      border:2px solid ${fillColor};
      opacity:0.85;cursor:pointer;
    "></div>`

    return L.divIcon({
      html,
      className: 'custom-div-icon',
      iconSize: [diameter, diameter],
      iconAnchor: [diameter / 2, diameter / 2],
      popupAnchor: [0, -diameter / 2],
    })
  }, [hasReview, record.isAnomaly])

  return (
    <Marker
      position={[record.latitude, record.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => setSelectedRecord(record.id),
      }}
    >
      <Popup>
        <div className="min-w-[200px] space-y-2 p-1">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-tide" />
            <span className="font-serif font-semibold text-tide">{record.id}</span>
          </div>
          <div className="text-sm">
            <span className="text-foam/60">站点：</span>
            <span className="text-foam">{record.stationName}</span>
          </div>
          <div className="text-sm">
            <span className="text-foam/60">参数：</span>
            <span className="font-mono text-foam">
              {record.parameter} = {record.value}{record.unit}
            </span>
            {record.isAnomaly && (
              <span className="ml-2 rounded bg-rust/20 px-1.5 py-0.5 text-xs text-rust">
                异常
              </span>
            )}
          </div>
          <div className="text-sm">
            <span className="text-foam/60">结论：</span>
            <span className="text-foam">{record.conclusion}</span>
          </div>
          <Link
            to={`/record/${record.id}`}
            className="inline-flex items-center gap-1 text-xs text-tide hover:text-tide-light"
          >
            查看详情 →
          </Link>
        </div>
      </Popup>
    </Marker>
  )
}

function MapMarkers() {
  const allRecords = useWaterQualityStore((s) => s.records)
  const reviews = useWaterQualityStore((s) => s.reviews)
  const filterStation = useWaterQualityStore((s) => s.filterStation)
  const filterAnomaly = useWaterQualityStore((s) => s.filterAnomaly)
  const filterSourceType = useWaterQualityStore((s) => s.filterSourceType)
  const allDataSources = useWaterQualityStore((s) => s.dataSources)

  const records = useMemo(() => {
    let filtered = allRecords
    if (filterStation) {
      filtered = filtered.filter((r) => r.stationName.includes(filterStation))
    }
    if (filterAnomaly === 'anomaly') {
      filtered = filtered.filter((r) => r.isAnomaly)
    } else if (filterAnomaly === 'normal') {
      filtered = filtered.filter((r) => !r.isAnomaly)
    }
    if (filterSourceType) {
      const recordIds = new Set(
        allDataSources.filter((ds) => ds.sourceType === filterSourceType).map((ds) => ds.recordId)
      )
      filtered = filtered.filter((r) => recordIds.has(r.id))
    }
    return filtered
  }, [allRecords, filterStation, filterAnomaly, filterSourceType, allDataSources])

  const reviewRecordIds = useMemo(
    () => new Set(reviews.map((r) => r.recordId)),
    [reviews]
  )

  return (
    <>
      {records.map((record) => (
        <RecordMarker
          key={record.id}
          record={record}
          hasReview={reviewRecordIds.has(record.id)}
        />
      ))}
    </>
  )
}

export default function MapCanvas() {
  const selectedRecordId = useWaterQualityStore((s) => s.selectedRecordId)

  return (
    <MapContainer
      center={[24.46, 118.09]}
      zoom={13}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapMarkers />
      <FlyToSelected selectedId={selectedRecordId} />
    </MapContainer>
  )
}
