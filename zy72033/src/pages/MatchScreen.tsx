import { useEffect, useMemo } from "react"
import { useMatchStore } from "@/store/useMatchStore"
import { useParams } from "react-router-dom"
import { Rocket, Timer, Pause, AlertTriangle } from "lucide-react"

function formatTime(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0")
  const s = String(sec % 60).padStart(2, "0")
  return `${m}:${s}`
}

function resourceColor(ratio: number) {
  if (ratio < 0 || ratio < 0.1) return "bg-alert-500"
  if (ratio < 0.3) return "bg-flame-500"
  return "bg-ok-500"
}

function resourceTextColor(remaining: number, limit: number) {
  const ratio = remaining / limit
  if (ratio < 0) return "text-alert-400"
  if (ratio < 0.1) return "text-alert-400"
  if (ratio < 0.3) return "text-flame-400"
  return "text-ok-400"
}

export default function MatchScreen() {
  const { id } = useParams()
  const load = useMatchStore((s) => s.load)
  const matchData = useMatchStore((s) => s.getMatch(id!))
  const timerSeconds = useMatchStore((s) => s.timerSeconds)
  const timerRunning = useMatchStore((s) => s.timerRunning)

  useEffect(() => {
    load()
  }, [load])

  const match = matchData?.match
  const teams = matchData?.teams ?? []
  const rounds = matchData?.rounds ?? []
  const teamRounds = matchData?.teamRounds ?? []

  const activeRound = useMemo(
    () => rounds.find((r) => r.status === "active" || r.status === "paused"),
    [rounds]
  )

  const currentTeamRounds = useMemo(() => {
    if (!activeRound) return []
    return teamRounds.filter((tr) => tr.roundId === activeRound.id)
  }, [activeRound, teamRounds])

  if (!matchData) {
    return (
      <div className="min-h-screen bg-space-900 flex items-center justify-center font-body">
        <p className="text-gray-400 text-lg">比赛未找到</p>
      </div>
    )
  }

  const isPaused = match.status === "paused"
  const isUrgent = timerSeconds < 10 && timerRunning
  const roundNum = activeRound?.roundNumber ?? 0
  const totalRounds = match.totalRounds

  return (
    <div className="min-h-screen bg-space-900 font-body relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-1 h-1 bg-white/20 rounded-full top-[10%] left-[20%] animate-pulse" />
        <div className="absolute w-0.5 h-0.5 bg-white/15 rounded-full top-[25%] left-[70%] animate-pulse" />
        <div className="absolute w-1 h-1 bg-white/10 rounded-full top-[60%] left-[15%] animate-pulse" />
        <div className="absolute w-0.5 h-0.5 bg-white/20 rounded-full top-[45%] left-[85%] animate-pulse" />
        <div className="absolute w-1 h-1 bg-white/15 rounded-full top-[80%] left-[50%] animate-pulse" />
        <div className="absolute w-0.5 h-0.5 bg-white/10 rounded-full top-[35%] left-[40%] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Rocket className="w-8 h-8 text-flame-500" />
            <h1 className="text-2xl font-bold text-white font-display tracking-wide">
              {match.name}
            </h1>
          </div>
          <div
            className={`font-display text-6xl font-bold tracking-widest ${
              isUrgent ? "text-alert-400 animate-pulse-glow" : "text-flame-400"
            }`}
          >
            <Timer className="inline w-10 h-10 mr-2 align-middle" />
            {formatTime(timerSeconds)}
          </div>
        </div>

        <div className="text-center mb-6">
          <span className="font-display text-3xl font-semibold text-white">
            第 {roundNum} / {totalRounds} 轮
          </span>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
          {teams.map((team) => {
            const tr = currentTeamRounds.find((t) => t.teamId === team.id)
            const remaining = tr?.resourceRemaining ?? match.resourceLimit
            const ratio = remaining / match.resourceLimit
            const barWidth = Math.max(0, Math.min(100, ratio * 100))
            const overBudget = remaining < 0

            return (
              <div key={team.id} className="card animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">{team.name}</h3>
                  {team.hasAnomaly && <span className="badge-anomaly">异常</span>}
                </div>
                <div className="text-sm text-gray-400 mb-1">燃料选择</div>
                <div className={`text-xl font-mono font-semibold mb-2 ${tr ? "text-flame-400" : "text-gray-500"}`}>
                  {tr ? `${tr.fuelChoice} 单位` : "等待选择..."}
                </div>
                <div className="text-sm text-gray-400 mb-1">剩余资源</div>
                <div className="w-full h-2 bg-space-600 rounded-full mb-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${resourceColor(ratio)}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className={`text-sm font-mono ${resourceTextColor(remaining, match.resourceLimit)}`}>
                  {remaining} / {match.resourceLimit}
                </div>
                {tr && (
                  <div className="mt-2 text-sm text-gray-300">
                    本轮扣分: <span className="font-mono text-alert-400">-{tr.deduction}</span>
                  </div>
                )}
                {overBudget && (
                  <div className="mt-1 flex items-center gap-1 text-alert-400 text-sm font-semibold animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                    资源超支
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-space-600/50 pt-4">
          <span className="text-gray-400 text-sm">{match.name}</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              match.status === "playing"
                ? "bg-ok-500/20 text-ok-400"
                : match.status === "paused"
                ? "bg-flame-500/20 text-flame-400"
                : match.status === "settled"
                ? "bg-space-600/50 text-gray-400"
                : "bg-space-600/30 text-gray-500"
            }`}
          >
            {match.status === "playing"
              ? "进行中"
              : match.status === "paused"
              ? "已暂停"
              : match.status === "settled"
              ? "已结算"
              : match.status === "locked"
              ? "已锁定"
              : "准备中"}
          </span>
        </div>
      </div>

      {isPaused && (
        <div className="fixed inset-0 z-50 bg-space-900/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="card text-center max-w-md w-full mx-4">
            <Pause className="w-16 h-16 text-flame-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">比赛暂停</h2>
            {match.pauseReason && (
              <p className="text-gray-300 mb-3">{match.pauseReason}</p>
            )}
            {match.pausedDurationSec > 0 && (
              <p className="text-sm text-gray-400 font-mono">
                已暂停 {formatTime(match.pausedDurationSec)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
