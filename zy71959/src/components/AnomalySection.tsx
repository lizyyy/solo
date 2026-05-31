import { useStore } from "@/store/useStore"
import { ANOMALY_LABELS, ANOMALY_STATUS_LABELS } from "@/types"
import type { AnomalyRecord, AnomalyStatus } from "@/types"
import { Battery, MapPin, ShieldAlert, CheckCircle, XCircle, ChevronRight, Link as LinkIcon } from "lucide-react"
import { useState, useMemo } from "react"

const anomalyIcons: Record<string, React.ReactNode> = {
  battery_cycle_error: <Battery size={18} />,
  return_point_lost: <MapPin size={18} />,
  no_fly_zone_edge: <ShieldAlert size={18} />,
}

const anomalyColors: Record<string, { border: string; bg: string; icon: string }> = {
  battery_cycle_error: { border: "border-accent-amber/40", bg: "bg-accent-amber/5", icon: "text-accent-amber" },
  return_point_lost: { border: "border-accent-red/40", bg: "bg-accent-red/5", icon: "text-accent-red" },
  no_fly_zone_edge: { border: "border-orange-500/40", bg: "bg-orange-500/5", icon: "text-orange-400" },
}

const statusStyles: Record<AnomalyStatus, { text: string; bg: string }> = {
  pending: { text: "text-accent-amber", bg: "bg-accent-amber/10" },
  confirmed: { text: "text-accent-red", bg: "bg-accent-red/10" },
  rejected: { text: "text-slate-400", bg: "bg-surface-500/20" },
}

function AnomalyCard({ anomaly }: { anomaly: AnomalyRecord }) {
  const reviewAnomaly = useStore((s) => s.reviewAnomaly)
  const [expanded, setExpanded] = useState(false)
  const [reviewMode, setReviewMode] = useState<"confirm" | "reject" | null>(null)
  const [reason, setReason] = useState("")
  const colors = anomalyColors[anomaly.type]
  const statusStyle = statusStyles[anomaly.status]

  const handleReview = (status: AnomalyStatus) => {
    if (!reason.trim()) return
    reviewAnomaly(anomaly.id, status, reason, "当前安全员")
    setReviewMode(null)
    setReason("")
  }

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden transition-all duration-300`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className={colors.icon}>{anomalyIcons[anomaly.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{ANOMALY_LABELS[anomaly.type]}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
              {ANOMALY_STATUS_LABELS[anomaly.status]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">{anomaly.description}</p>
        </div>
        <ChevronRight size={16} className={`text-slate-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in">
          <div className="bg-surface-800/50 rounded-lg p-3 space-y-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">自动检测原因</span>
              <p className="text-xs text-slate-300 mt-0.5 font-mono">{anomaly.detectionReason}</p>
            </div>
            {anomaly.sourceLinks.length > 0 && (
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">溯源链接</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {anomaly.sourceLinks.map((link) => (
                    <span key={link} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-600 rounded text-[10px] text-accent-blue">
                      <LinkIcon size={10} />
                      {link}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {anomaly.status !== "pending" && anomaly.reviewReason && (
            <div className="bg-surface-800/50 rounded-lg p-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                复核原因 — {anomaly.reviewer} · {anomaly.reviewDate}
              </span>
              <p className="text-xs text-slate-300 mt-0.5">{anomaly.reviewReason}</p>
            </div>
          )}

          {anomaly.status === "pending" && (
            <div className="space-y-2">
              {!reviewMode ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReviewMode("confirm")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-green bg-accent-green/10 border border-accent-green/30 rounded-lg hover:bg-accent-green/20 transition-colors"
                  >
                    <CheckCircle size={14} />
                    确认正常
                  </button>
                  <button
                    onClick={() => setReviewMode("reject")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg hover:bg-accent-red/20 transition-colors"
                  >
                    <XCircle size={14} />
                    确认异常
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={`请填写复核原因（${reviewMode === "confirm" ? "为何确认正常" : "为何确认异常"}）...`}
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-500/30 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-green/50 resize-none"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(reviewMode === "confirm" ? "confirmed" : "rejected")}
                      disabled={!reason.trim()}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        reviewMode === "confirm"
                          ? "text-accent-green bg-accent-green/10 hover:bg-accent-green/20"
                          : "text-accent-red bg-accent-red/10 hover:bg-accent-red/20"
                      }`}
                    >
                      提交
                    </button>
                    <button
                      onClick={() => { setReviewMode(null); setReason("") }}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AnomalySection({ routeId }: { routeId: string }) {
  const anomalies = useStore((s) => s.anomalies)
  const routeAnomalies = useMemo(() => anomalies.filter((a) => a.routeId === routeId), [anomalies, routeId])

  if (routeAnomalies.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 bg-accent-green/5 border border-accent-green/20 rounded-xl text-sm text-accent-green">
        <CheckCircle size={18} />
        该航线未检测到异常，所有指标均在正常范围内
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <ShieldAlert size={16} className="text-accent-amber" />
          异常记录
          <span className="text-xs text-slate-500 font-mono">{routeAnomalies.length}</span>
        </h3>
      </div>
      {routeAnomalies.map((anomaly) => (
        <AnomalyCard key={anomaly.id} anomaly={anomaly} />
      ))}
    </div>
  )
}
