import { useEffect } from "react"
import { useMatchStore } from "@/store/useMatchStore"
import { useParams, useNavigate } from "react-router-dom"
import { Trophy, AlertTriangle, Lock, ArrowLeft, Monitor, Download, FileText } from "lucide-react"
import { exportCSV, exportTXT, downloadFile } from "@/utils/exportUtils"

const MEDAL_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32"]

export default function Settlement() {
  const { id } = useParams()
  const navigate = useNavigate()
  const load = useMatchStore((s) => s.load)
  const matchData = useMatchStore((s) => s.getMatch(id!))
  const lockMatch = useMatchStore((s) => s.lockMatch)

  useEffect(() => { load() }, [load])

  if (!matchData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        对局数据未找到
      </div>
    )
  }

  const { match, teams, rounds, teamRounds } = matchData

  const getTeamRounds = (teamId: string) =>
    teamRounds
      .filter((tr) => tr.teamId === teamId)
      .sort((a, b) => {
        const ra = rounds.find((r) => r.id === a.roundId)
        const rb = rounds.find((r) => r.id === b.roundId)
        return (ra?.roundNumber ?? 0) - (rb?.roundNumber ?? 0)
      })

  const getRoundNumber = (roundId: string) =>
    rounds.find((r) => r.id === roundId)?.roundNumber ?? 0

  const sortedTeams = [...teams].sort((a, b) => b.totalScore - a.totalScore)

  const hasOverspend = (teamId: string) =>
    teamRounds.some((tr) => tr.teamId === teamId && tr.resourceRemaining < 0)

  const needsConfirm = (teamId: string) =>
    teamRounds.some((tr) => tr.teamId === teamId && tr.needsConfirmation)

  const isProjection = (teamId: string) =>
    teamRounds.some((tr) => tr.teamId === teamId && tr.source === "projection_screen") ||
    teams.find((t) => t.id === teamId)?.source === "projection_screen"

  const handleLock = () => lockMatch(match.id)

  const handleExportCSV = () => {
    const csv = exportCSV(matchData)
    downloadFile(csv, `${match.name}_成绩.csv`, "text/csv;charset=utf-8")
  }

  const handleExportTXT = () => {
    const txt = exportTXT(matchData)
    downloadFile(txt, `${match.name}_回放报告.txt`, "text/plain;charset=utf-8")
  }

  return (
    <div className="min-h-screen bg-space-900 pb-28">
      <header className="bg-space-800/90 border-b border-space-600/50 px-6 py-4 sticky top-0 z-20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl text-flame-400 tracking-wider">结算页面</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-body">
              {match.name} · {new Date(match.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => navigate("/")}>
              <ArrowLeft size={16} /> 返回控制台
            </button>
            <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => navigate(`/match/${id}`)}>
              <Monitor size={16} /> 投影大屏
            </button>
            {match.status === "settled" && (
              <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={handleLock}>
                <Lock size={16} /> 锁定结算
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {teams.map((team, idx) => {
          const trs = getTeamRounds(team.id)
          const lastTr = trs[trs.length - 1]
          const remaining = lastTr?.resourceRemaining ?? match.resourceLimit
          const limit = match.resourceLimit
          const pct = Math.max(0, Math.min(100, (remaining / limit) * 100))
          const overspend = hasOverspend(team.id)
          const confirm = needsConfirm(team.id)
          const projection = isProjection(team.id)
          const teamNote = team.rawNote

          return (
            <div
              key={team.id}
              className="card-glow animate-slide-up"
              style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-100 font-body">{team.name}</h2>
                  {overspend && (
                    <span className="badge-anomaly flex items-center gap-1">
                      <AlertTriangle size={12} /> 资源超支
                    </span>
                  )}
                  {confirm && <span className="badge-anomaly flex items-center gap-1">需确认</span>}
                  {projection && <span className="badge-projection flex items-center gap-1">🔥 投影大屏补录</span>}
                </div>
                <div className="text-3xl font-display font-bold text-flame-400">{team.totalScore}</div>
              </div>

              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-space-600/50">
                    <th className="py-1.5 pr-3 font-mono text-xs">轮次</th>
                    <th className="py-1.5 pr-3 font-mono text-xs">燃料</th>
                    <th className="py-1.5 pr-3 font-mono text-xs">消耗/剩余</th>
                    <th className="py-1.5 pr-3 font-mono text-xs">扣分</th>
                    <th className="py-1.5 font-mono text-xs">扣分原因</th>
                  </tr>
                </thead>
                <tbody>
                  {trs.map((tr) => (
                    <tr
                      key={tr.id}
                      className={`border-b border-space-600/30 ${tr.resourceRemaining < 0 ? "bg-alert-500/5" : ""} ${tr.isAnomaly ? "bg-alert-500/5" : ""}`}
                    >
                      <td className="py-1.5 pr-3 font-mono text-gray-300">R{getRoundNumber(tr.roundId)}</td>
                      <td className="py-1.5 pr-3 font-mono text-gray-200">{tr.fuelChoice}</td>
                      <td className="py-1.5 pr-3 font-mono">
                        <span className="text-gray-300">{tr.resourceUsed}</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className={tr.resourceRemaining < 0 ? "text-alert-400 font-bold" : "text-ok-400"}>
                          {tr.resourceRemaining}
                        </span>
                        {tr.resourceRemaining < 0 && (
                          <span className="badge-anomaly ml-2">超支{Math.abs(tr.resourceRemaining)}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-alert-400">{tr.deduction}</td>
                      <td className="py-1.5 text-gray-300 text-xs">
                        {tr.deductionReason}
                        {tr.needsConfirmation && (
                          <span className="ml-2 text-alert-400 font-medium">需确认: {tr.confirmationNote}</span>
                        )}
                        {tr.source === "projection_screen" && (
                          <>
                            <span className="ml-2 badge-projection">📺 投影大屏补录</span>
                            {tr.projectionRecordedAt && (
                              <span className="ml-2 text-xs text-flame-400 font-mono">
                                🕒 {new Date(tr.projectionRecordedAt).toLocaleString("zh-CN")}
                                {tr.projectionOperator && `（${tr.projectionOperator}）`}
                              </span>
                            )}
                          </>
                        )}
                        {tr.rawNote && <span className="ml-2 text-gray-500 text-xs italic">[{tr.rawNote}]</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="label-text">资源余量</span>
                  <span className={`font-mono text-sm ${remaining < 0 ? "text-alert-400" : "text-ok-400"}`}>
                    {remaining} / {limit}
                  </span>
                </div>
                <div className="h-2.5 bg-space-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${remaining < 0 ? "bg-alert-500" : "bg-ok-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {teamNote && (
                <p className="mt-2 text-xs text-gray-500 font-mono bg-space-800/60 px-3 py-1.5 rounded-lg">
                  {teamNote}
                </p>
              )}
            </div>
          )
        })}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-space-800/95 border-t border-space-600/50 backdrop-blur-sm z-30">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-x-auto">
              <Trophy size={18} className="text-flame-400 shrink-0" />
              {sortedTeams.map((team, idx) => (
                <div key={team.id} className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="font-display font-bold text-sm"
                    style={{ color: idx < 3 ? MEDAL_COLORS[idx] : "#9ca3af" }}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-200">{team.name}</span>
                  <span className="font-mono text-sm text-gray-400">{team.totalScore}</span>
                  {team.hasAnomaly && <span className="text-alert-400 text-xs">⚠️</span>}
                  {needsConfirm(team.id) && (
                    <span className="text-alert-400 text-xs">需确认</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={handleExportCSV}>
                <Download size={14} /> 导出成绩CSV
              </button>
              <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={handleExportTXT}>
                <FileText size={14} /> 导出回放报告
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
