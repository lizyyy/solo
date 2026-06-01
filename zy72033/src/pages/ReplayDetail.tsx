import { useMemo, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Download, FileText, Clock, AlertTriangle, Monitor } from "lucide-react"
import { useMatchStore } from "@/store/useMatchStore"
import { exportCSV, exportTXT, downloadFile } from "@/utils/exportUtils"

export default function ReplayDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const load = useMatchStore((s) => s.load)
  const data = useMatchStore((s) => s.getMatch(id!))

  useEffect(() => { load() }, [load])

  const sortedTeams = useMemo(() => {
    if (!data) return []
    return [...data.teams].sort((a, b) => b.totalScore - a.totalScore)
  }, [data])

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center font-body">
        <div className="text-center">
          <p className="text-gray-400 mb-4">对局不存在</p>
          <button className="btn-secondary" onClick={() => navigate("/replay")}>返回列表</button>
        </div>
      </div>
    )
  }

  const { match, teams, rounds, teamRounds } = data

  const getTeamRound = (roundId: string, teamId: string) =>
    teamRounds.find((tr) => tr.roundId === roundId && tr.teamId === teamId)

  const pausedRounds = rounds.filter((r) => r.pauseReason)

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto animate-fade-in font-body">
      <div className="flex items-center justify-between mb-6">
        <button className="btn-secondary flex items-center gap-2" onClick={() => navigate("/replay")}>
          <ArrowLeft size={16} /> 返回列表
        </button>
        <div className="flex gap-2">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => downloadFile(exportCSV(data), `${match.name}_复盘.csv`, "text/csv;charset=utf-8")}
          >
            <Download size={16} /> CSV
          </button>
          <button
            className="btn-ok flex items-center gap-2"
            onClick={() => downloadFile(exportTXT(data), `${match.name}_复盘.txt`, "text/plain;charset=utf-8")}
          >
            <FileText size={16} /> TXT
          </button>
        </div>
      </div>

      <div className="card-glow mb-6">
        <h1 className="font-display text-xl text-flame-400 mb-1">{match.name}</h1>
        <div className="flex gap-4 text-sm text-gray-400 flex-wrap">
          <span>{new Date(match.createdAt).toLocaleString("zh-CN")}</span>
          <span>{match.totalRounds}轮</span>
          <span>资源上限 {match.resourceLimit}</span>
          <span className="badge-normal">{match.status}</span>
        </div>
      </div>

      <div className="relative pl-8">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-space-600" />
        {rounds.map((round) => (
          <div key={round.id} className="relative mb-8 animate-slide-up">
            <div className="absolute -left-5 w-6 h-6 rounded-full bg-space-700 border-2 border-flame-500 flex items-center justify-center">
              <span className="text-[10px] font-mono text-flame-400">{round.roundNumber}</span>
            </div>
            <div className="card ml-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-sm text-gray-300">第 {round.roundNumber} 轮</span>
                {round.pauseReason && (
                  <span className="flex items-center gap-1 text-xs text-alert-400">
                    <Clock size={12} /> 暂停{round.pausedDurationSec}s: {round.pauseReason}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {teams.map((team) => {
                  const tr = getTeamRound(round.id, team.id)
                  if (!tr) {
                    return (
                      <div key={team.id} className="text-sm text-gray-500 bg-space-800/50 rounded-lg px-3 py-2">
                        {team.name}：未记录
                      </div>
                    )
                  }
                  return (
                    <div
                      key={team.id}
                      className={`rounded-lg px-3 py-2 bg-space-800/50 ${
                        tr.resourceRemaining < 0 ? "border border-alert-500/40" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-200">{team.name}</span>
                          {tr.source === "projection_screen" && (
                            <span className="badge-projection flex items-center gap-1">
                              <Monitor size={10} /> 投影补录
                            </span>
                          )}
                          {tr.needsConfirmation && (
                            <span className="bg-alert-500/20 text-alert-400 text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle size={10} /> 需确认: {tr.confirmationNote}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm font-mono">
                          <span className="text-gray-400">选择 {tr.fuelChoice}</span>
                          <span className="text-gray-400">消耗 {tr.resourceUsed}</span>
                          <span className={tr.resourceRemaining < 0 ? "text-alert-400 font-bold" : "text-ok-400"}>
                            剩余 {tr.resourceRemaining}
                          </span>
                        </div>
                      </div>
                      {tr.resourceRemaining < 0 && (
                        <div className="text-xs text-alert-400 mt-1 flex items-center gap-1">
                          <AlertTriangle size={10} /> 资源超支！{tr.anomalyNote}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        扣分 {tr.deduction}（{tr.deductionReason}）
                      </div>
                      {tr.rawNote && (
                        <div className="text-xs text-flame-400/70 mt-1 font-mono break-all">
                          📝 {tr.rawNote}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pausedRounds.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display text-sm text-flame-400 mb-3 flex items-center gap-2">
            <Clock size={14} /> 暂停记录
          </h2>
          <div className="space-y-2">
            {pausedRounds.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm bg-space-800/50 rounded-lg px-3 py-2">
                <span className="font-mono text-gray-400">第{r.roundNumber}轮</span>
                <span className="text-alert-400">{r.pausedDurationSec}s</span>
                <span className="text-gray-300">{r.pauseReason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-glow mt-8 mb-8">
        <h2 className="font-display text-lg text-flame-400 mb-3">最终排名</h2>
        <div className="space-y-2">
          {sortedTeams.map((team, idx) => (
            <div
              key={team.id}
              className="flex items-center justify-between bg-space-800/50 rounded-lg px-4 py-2"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`font-display text-lg ${
                    idx === 0 ? "text-flame-400" : idx === 1 ? "text-gray-300" : "text-gray-500"
                  }`}
                >
                  #{idx + 1}
                </span>
                <span className="text-gray-200">{team.name}</span>
                {team.hasAnomaly && <span className="badge-anomaly">⚠️ 异常</span>}
                {team.source === "projection_screen" && <span className="badge-projection">📺 补录</span>}
              </div>
              <span className="font-mono text-flame-400 text-lg">{team.totalScore}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
