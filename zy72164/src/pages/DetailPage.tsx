import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, MapPin, Clock, AlertTriangle, FileText, BarChart3, ExternalLink } from "lucide-react"
import { useAlertStore } from "@/store/alertStore"
import Timeline from "@/components/Timeline"
import PhotoSection from "@/components/PhotoSection"
import ActionPanel from "@/components/ActionPanel"

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  processed: { label: "已处理", color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  pending: { label: "待核实", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  recheck: { label: "需现场复看", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
}

const sourceTypeLabel: Record<string, string> = {
  inspection_report: "巡检报告",
  inspection_photo: "巡检照片",
  complaint: "市民投诉",
  statistics: "统计数据",
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const getAlertById = useAlertStore((s) => s.getAlertById)
  const alert = id ? getAlertById(id) : undefined

  if (!alert) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-2">未找到该预警记录</p>
          <button onClick={() => navigate(-1)} className="text-[#4a90d9] text-sm hover:underline">
            返回上一页
          </button>
        </div>
      </div>
    )
  }

  const sc = statusConfig[alert.status]
  const firstSource = alert.sources[0]

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <div className="pb-28">
        <div className="sticky top-0 z-40 bg-[#0f0f1a]/95 backdrop-blur border-b border-white/10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-base font-medium text-white flex-1 truncate">{alert.name}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0" style={{ color: sc.color, backgroundColor: sc.bg }}>
              {sc.label}
            </span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <div className="bg-[#1a1a2e] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-[#4a90d9] shrink-0" />
              <span className="text-xs font-mono text-gray-300">{alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-[#4a90d9] shrink-0" />
              <span className="text-xs text-gray-400">来源类型：</span>
              <span className="text-xs text-gray-200">{sourceTypeLabel[alert.sourceType]}</span>
            </div>
            {firstSource && (
              <>
                <div className="flex items-center gap-2">
                  <ExternalLink size={14} className="text-[#4a90d9] shrink-0" />
                  <span className="text-xs text-gray-400">原始编号：</span>
                  <span className="text-xs text-[#4a90d9]">{firstSource.referenceNo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[#4a90d9] shrink-0" />
                  <span className="text-xs text-gray-400">首次记录：</span>
                  <span className="text-xs font-mono text-gray-300">{formatTime(firstSource.recordedAt)}</span>
                </div>
              </>
            )}
            {alert.isOldCaliber && (
              <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/30">
                旧口径补录
              </span>
            )}
          </div>

          {alert.coordinateDrift && (
            <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#f59e0b]/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-[#f59e0b]" />
                <span className="text-sm text-[#f59e0b] font-medium">坐标偏移提醒</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">
                原始坐标与校准坐标偏移 <span className="font-mono text-[#f59e0b]">{alert.coordinateDrift.driftMeters}米</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0f0f1a] rounded-lg p-2">
                  <p className="text-gray-500 mb-1">原始坐标</p>
                  <p className="font-mono text-gray-300">{alert.coordinateDrift.originalLat.toFixed(4)}, {alert.coordinateDrift.originalLng.toFixed(4)}</p>
                </div>
                <div className="bg-[#0f0f1a] rounded-lg p-2">
                  <p className="text-gray-500 mb-1">校准坐标</p>
                  <p className="font-mono text-[#10b981]">{alert.coordinateDrift.correctedLat.toFixed(4)}, {alert.coordinateDrift.correctedLng.toFixed(4)}</p>
                </div>
              </div>
            </div>
          )}

          {alert.duplicateComplaintIds.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-xl p-4 border border-[#ef4444]/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-[#ef4444]" />
                <span className="text-sm text-[#ef4444] font-medium">关联重复投诉</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {alert.duplicateComplaintIds.map((linkedId) => (
                  <button
                    key={linkedId}
                    onClick={() => navigate(`/alert/${linkedId}`)}
                    className="px-2 py-1 rounded-lg text-xs font-mono text-[#4a90d9] bg-[#4a90d9]/10 border border-[#4a90d9]/20 hover:bg-[#4a90d9]/20 transition-colors"
                  >
                    {linkedId}
                  </button>
                ))}
              </div>
            </div>
          )}

          {alert.timePeriodStats && alert.timePeriodStats.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-[#4a90d9]" />
                <span className="text-sm text-white font-medium">时段统计</span>
              </div>
              <div className="space-y-2">
                {alert.timePeriodStats.map((stat, i) => (
                  <div key={i} className="bg-[#0f0f1a] rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-2">{stat.period}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">工作日均值</p>
                        <p className="font-mono text-gray-200">{stat.weekdayAvg.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">周末均值</p>
                        <p className="font-mono text-gray-200">{stat.weekendAvg.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">高峰时段</p>
                        <p className="font-mono text-[#ef4444]">{stat.peakHour}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#1a1a2e] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-4">处理时间线</h3>
            <Timeline sources={alert.sources} processRecords={alert.processRecords} />
          </div>

          {alert.inspectionPhotoUrls.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-xl p-4">
              <PhotoSection urls={alert.inspectionPhotoUrls} isOldCaliber={alert.isOldCaliber} />
            </div>
          )}
        </div>
      </div>

      <ActionPanel alertId={alert.id} />
    </div>
  )
}
