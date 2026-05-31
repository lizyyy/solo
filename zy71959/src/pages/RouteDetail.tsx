import { useParams, useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { STATUS_LABELS } from "@/types"
import FlightDataCards from "@/components/FlightDataCards"
import AnomalySection from "@/components/AnomalySection"
import PhotoGrid from "@/components/PhotoGrid"
import KMLViewer from "@/components/KMLViewer"
import { ArrowLeft, User, Calendar, Camera, Map, ShieldAlert } from "lucide-react"
import { useMemo } from "react"

export default function RouteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const routes = useStore((s) => s.routes)
  const kmlTracks = useStore((s) => s.kmlTracks)

  const route = useMemo(() => routes.find((r) => r.id === id), [routes, id])
  const track = useMemo(() => kmlTracks.find((k) => k.routeId === id), [kmlTracks, id])

  if (!id) {
    return <div className="text-center py-16 text-slate-500">参数错误</div>
  }

  if (!route) {
    return <div className="text-center py-16 text-slate-500">航线不存在</div>
  }

  const statusColors: Record<string, string> = {
    normal: "text-accent-green",
    pending: "text-accent-amber",
    abnormal: "text-accent-red",
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg bg-surface-700 border border-surface-500/30 hover:bg-surface-600 transition-colors"
          >
            <ArrowLeft size={16} className="text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-100">{route.name}</h1>
              <span className={`text-xs font-medium ${statusColors[route.status]}`}>
                {STATUS_LABELS[route.status]}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
              <span className="font-mono">{route.id}</span>
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {route.date}
              </span>
              <span className="flex items-center gap-1">
                <User size={10} />
                飞手: {route.pilot}
              </span>
              <span className="flex items-center gap-1">
                <User size={10} />
                巡检: {route.inspector}
              </span>
              <span className="flex items-center gap-1">
                <User size={10} />
                安全员: {route.safetyOfficer}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Map size={16} className="text-accent-blue" />
          飞行数据
        </h2>
        <FlightDataCards route={route} />
      </div>

      <div>
        <AnomalySection routeId={route.id} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Camera size={16} className="text-accent-green" />
            巡检照片溯源
            <span className="text-[10px] text-slate-500">点击结论可查看对应照片</span>
          </h2>
          <PhotoGrid routeId={route.id} />
        </div>
        <div>
          <h2 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Map size={16} className="text-accent-blue" />
            航线轨迹 (KML)
          </h2>
          <KMLViewer routeId={route.id} />
          {track && (
            <div className="mt-3 space-y-2">
              <div className="bg-surface-700/50 border border-surface-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert size={14} className="text-slate-500" />
                  <span className="text-xs text-slate-400">轨迹信息</span>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5 font-mono">
                  <p>坐标点数: {track.coordinates.length}</p>
                  <p>异常标注: {track.anomalyPoints.length} 处</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
