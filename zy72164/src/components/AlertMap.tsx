import { useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { AlertTriangle } from "lucide-react"
import { useAlertStore } from "@/store/alertStore"
import type { AlertStatus, AlertPoint } from "@/types/alert"

const statusColors: Record<AlertStatus, string> = {
  processed: "#10b981",
  pending: "#f59e0b",
  recheck: "#ef4444",
}

const statusLabels: Record<AlertStatus, string> = {
  processed: "已处理",
  pending: "待核实",
  recheck: "需复看",
}

const sourceLabels: Record<string, string> = {
  inspection_report: "巡检报告",
  inspection_photo: "巡检照片",
  complaint: "市民投诉",
  statistics: "统计数据",
}

function createIcon(alert: AlertPoint) {
  const color = statusColors[alert.status]
  const hasWarning = alert.duplicateComplaintIds.length > 0
  const size = hasWarning ? 28 : 20
  const warningDot = hasWarning
    ? `<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#eab308;border-radius:50%;border:2px solid #1a1a2e;display:flex;align-items:center;justify-content:center;font-size:8px;color:#1a1a2e;font-weight:bold;">!</div>`
    : ""

  return L.divIcon({
    className: "custom-marker",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:3px solid rgba(255,255,255,0.8);box-shadow:0 0 8px ${color}80;"></div>
      ${warningDot}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface AlertMapProps {
  onViewDetail: (id: string) => void
}

export default function AlertMap({ onViewDetail }: AlertMapProps) {
  const alerts = useAlertStore((s) => s.alerts)
  const filter = useAlertStore((s) => s.filter)
  const selectAlert = useAlertStore((s) => s.selectAlert)

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filter.status !== "all" && a.status !== filter.status) return false
      if (filter.sourceType !== "all" && a.sourceType !== filter.sourceType) return false
      return true
    })
  }, [alerts, filter])

  const markers = useMemo(
    () =>
      filteredAlerts.map((alert) => ({
        alert,
        icon: createIcon(alert),
        position: [alert.lat, alert.lng] as [number, number],
      })),
    [filteredAlerts]
  )

  return (
    <div className="flex-1 h-full">
      <MapContainer
        center={[31.23, 121.47]}
        zoom={15}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {markers.map(({ alert, icon, position }) => (
          <Marker key={alert.id} position={position} icon={icon}>
            <Popup>
              <div className="min-w-[220px] font-sans">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 text-sm">
                    {alert.name}
                  </h3>
                  {alert.duplicateComplaintIds.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                      <AlertTriangle size={10} />
                      同名
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: statusColors[alert.status] }}
                  >
                    {statusLabels[alert.status]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {sourceLabels[alert.sourceType]}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-gray-400 mb-1">
                  📍 {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                </div>

                <div className="text-[11px] text-gray-400 mb-2">
                  更新: {formatTime(alert.updatedAt)}
                </div>

                {alert.isOldCaliber && (
                  <div className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-400 text-yellow-700 bg-yellow-50 mb-2">
                    旧口径数据
                  </div>
                )}

                <button
                  onClick={() => {
                    selectAlert(alert.id)
                    onViewDetail(alert.id)
                  }}
                  className="w-full py-1.5 rounded text-xs font-medium text-white transition-colors"
                  style={{ backgroundColor: "#4a90d9" }}
                >
                  查看详情
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
