import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Rocket, Search, ArrowLeft, Download } from "lucide-react"
import { useMatchStore } from "@/store/useMatchStore"
import { exportCSV, downloadFile } from "@/utils/exportUtils"

type FilterType = "all" | "normal" | "anomaly" | "confirm" | "projection"

const FILTER_LABELS: Record<FilterType, string> = {
  all: "全部",
  normal: "正常",
  anomaly: "异常",
  confirm: "需确认",
  projection: "旧口径",
}

function statusBadge(status: string) {
  switch (status) {
    case "settled":
      return <span className="badge-normal">已结算</span>
    case "locked":
      return <span className="badge-normal">已锁定</span>
    case "playing":
      return <span className="badge-projection">进行中</span>
    case "paused":
      return <span className="badge-anomaly">已暂停</span>
    default:
      return <span className="label-text">{status}</span>
  }
}

export default function Replay() {
  const navigate = useNavigate()
  const load = useMatchStore((s) => s.load)
  const matches = useMatchStore((s) => s.matches)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return matches.filter((md) => {
      if (search && !md.match.name.toLowerCase().includes(search.toLowerCase())) return false
      const hasAnomaly = md.teams.some((t) => t.hasAnomaly)
      const hasConfirm = md.teamRounds.some((tr) => tr.needsConfirmation)
      const hasProjection = md.teams.some((t) => t.source === "projection_screen")
      switch (filter) {
        case "anomaly":
          return hasAnomaly
        case "confirm":
          return hasConfirm
        case "projection":
          return hasProjection
        case "normal":
          return !hasAnomaly && !hasConfirm && !hasProjection
        default:
          return true
      }
    })
  }, [matches, search, filter])

  const handleExportAll = () => {
    if (matches.length === 0) return
    const parts = matches.map((md, i) => {
      const csv = exportCSV(md)
      return i === 0 ? csv : csv.replace("\uFEFF", "")
    })
    downloadFile(
      parts.join("\n\n"),
      `全部复盘_${new Date().toLocaleDateString("zh-CN")}.csv`,
      "text/csv;charset=utf-8"
    )
  }

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto animate-fade-in font-body">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2" onClick={() => navigate("/")}>
            <ArrowLeft size={16} /> 返回控制台
          </button>
          <h1 className="font-display text-2xl text-flame-400 flex items-center gap-2">
            <Rocket size={28} /> 复盘
          </h1>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={handleExportAll}>
          <Download size={16} /> 导出全部
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input-field w-full pl-10"
          placeholder="搜索比赛名称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((key) => (
          <button
            key={key}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              filter === key
                ? "bg-flame-500 text-white"
                : "bg-space-700 text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => setFilter(key)}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12">暂无匹配的对局</div>
        )}
        {filtered.map((md) => {
          const hasProjection = md.teams.some((t) => t.source === "projection_screen")
          const hasAnomaly = md.teams.some((t) => t.hasAnomaly)
          const hasConfirm = md.teamRounds.some((tr) => tr.needsConfirmation)
          return (
            <div
              key={md.match.id}
              className="card-glow cursor-pointer hover:border-flame-500/50 transition-all animate-slide-up"
              onClick={() => navigate(`/replay/${md.match.id}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg text-gray-100">{md.match.name}</h3>
                {statusBadge(md.match.status)}
              </div>
              <div className="text-sm text-gray-400 mb-2">
                {new Date(md.match.createdAt).toLocaleString("zh-CN")}
              </div>
              <div className="flex gap-2 mb-3 flex-wrap">
                {hasProjection && <span className="badge-projection">📺 投影大屏补录</span>}
                {hasAnomaly && <span className="badge-anomaly">⚠️ 异常</span>}
                {hasConfirm && (
                  <span className="bg-alert-500/20 text-alert-400 text-xs px-2 py-0.5 rounded-full">
                    需确认
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {md.teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between bg-space-800/50 rounded-lg px-3 py-1.5"
                  >
                    <span className="text-sm text-gray-300">{team.name}</span>
                    <span className="font-mono text-sm text-flame-400">{team.totalScore}分</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
