import type { PVRoute } from "@/types"
import { Battery, Clock, MapPin, Navigation, Wifi, Thermometer } from "lucide-react"

function DataCard({ icon, label, value, unit, color, anomaly }: { icon: React.ReactNode; label: string; value: string | number; unit?: string; color: string; anomaly?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02] ${
      anomaly
        ? "bg-accent-amber/5 border-accent-amber/30"
        : "bg-surface-700/50 border-surface-500/20"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={anomaly ? "text-accent-amber" : color}>{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold font-mono ${anomaly ? "text-accent-amber" : "text-slate-100"}`}>
          {value}
        </span>
        {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </div>
      {anomaly && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-amber animate-pulse" />
      )}
    </div>
  )
}

export default function FlightDataCards({ route }: { route: PVRoute }) {
  const cycleDiff = Math.abs(route.batteryCycles - route.expectedCycles)
  const batteryAnomaly = cycleDiff > 2
  const rthAnomaly = route.returnPointStatus !== "ok"
  const nfzAnomaly = route.noFlyZoneDistance < 50

  const returnPointLabel = route.returnPointStatus === "ok" ? "正常" : route.returnPointStatus === "lost" ? "丢失" : "低高度"

  return (
    <div className="grid grid-cols-3 gap-3">
      <DataCard
        icon={<Battery size={16} />}
        label="电池循环"
        value={route.batteryCycles}
        unit={`次 (预期${route.expectedCycles})`}
        color="text-accent-green"
        anomaly={batteryAnomaly}
      />
      <DataCard
        icon={<Clock size={16} />}
        label="飞行时长"
        value={route.flightDuration}
        unit="min"
        color="text-accent-blue"
      />
      <DataCard
        icon={<Navigation size={16} />}
        label="返航点状态"
        value={returnPointLabel}
        color="text-accent-green"
        anomaly={rthAnomaly}
      />
      <DataCard
        icon={<MapPin size={16} />}
        label="禁飞区距离"
        value={route.noFlyZoneDistance}
        unit="m"
        color="text-accent-green"
        anomaly={nfzAnomaly}
      />
      <DataCard
        icon={<Thermometer size={16} />}
        label="循环偏差"
        value={cycleDiff}
        unit="次"
        color="text-slate-400"
        anomaly={batteryAnomaly}
      />
      <DataCard
        icon={<Wifi size={16} />}
        label="信号状态"
        value="稳定"
        color="text-accent-green"
      />
    </div>
  )
}
