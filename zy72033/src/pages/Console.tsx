import { useState, useEffect } from "react"
import { useMatchStore } from "@/store/useMatchStore"
import { useNavigate } from "react-router-dom"
import { Rocket, Timer, Pause, Play, AlertTriangle, Plus, Monitor, X, ChevronRight, SkipForward, CheckCircle } from "lucide-react"

export default function Console() {
  const navigate = useNavigate()
  const {
    load, getAllMatches, getMatch, createMatch, startMatch,
    pauseMatch, resumeMatch, submitTeamChoice, endRound, startNextRound,
    confirmAnomaly, addProjectionRecord, timerSeconds, timerRunning,
    setTimerRunning, decrementTimer, activeMatchId, setActiveMatchId
  } = useMatchStore()

  const [name, setName] = useState("")
  const [teamCount, setTeamCount] = useState(3)
  const [totalRounds, setTotalRounds] = useState(3)
  const [roundDurationSec, setRoundDurationSec] = useState(90)
  const [resourceLimit, setResourceLimit] = useState(100)
  const [pauseReason, setPauseReason] = useState("")
  const [showPauseInput, setShowPauseInput] = useState(false)
  const [fuelInputs, setFuelInputs] = useState<Record<string, string>>({})
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set())
  const [showProjection, setShowProjection] = useState(false)
  const [projTeamName, setProjTeamName] = useState("")
  const [projRound, setProjRound] = useState(1)
  const [projFuel, setProjFuel] = useState("")
  const [projNote, setProjNote] = useState("")
  const [projMsg, setProjMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!timerRunning) return
    const iv = setInterval(() => {
      if (decrementTimer() <= 0) setTimerRunning(false)
    }, 1000)
    return () => clearInterval(iv)
  }, [timerRunning])

  const matchData = activeMatchId ? getMatch(activeMatchId) : undefined
  const match = matchData?.match
  const isActive = !!match
  const activeRound = matchData?.rounds.find(r => r.status === "active" || r.status === "paused")
  const anomalies = (matchData?.teamRounds ?? []).filter(tr => tr.resourceRemaining < 0 && !dismissedAnomalies.has(tr.id))
  const allMatches = getAllMatches()

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

  const handleCreate = () => {
    if (!name.trim()) return
    createMatch(name, teamCount, totalRounds, roundDurationSec, resourceLimit)
    setName("")
  }

  const handleStart = () => { if (match) startMatch(match.id) }

  const handlePause = () => {
    if (!match) return
    if (!showPauseInput) { setShowPauseInput(true); return }
    pauseMatch(match.id, pauseReason)
    setPauseReason("")
    setShowPauseInput(false)
  }

  const handleResume = () => { if (match) resumeMatch(match.id) }

  const handleEndRound = () => { if (match && activeRound) endRound(match.id, activeRound.id) }

  const handleStartNextRound = () => { if (match) startNextRound(match.id) }

  const handleFuel = (teamId: string) => {
    if (!match || !activeRound) return
    const v = Number(fuelInputs[teamId])
    if (isNaN(v) || v < 0) return
    submitTeamChoice(match.id, activeRound.id, teamId, v)
    setFuelInputs(p => { const n = { ...p }; delete n[teamId]; return n })
  }

  const handleConfirm = (trId: string) => {
    if (!match) return
    confirmAnomaly(match.id, trId, "已确认")
    setDismissedAnomalies(p => new Set(p).add(trId))
  }

  const handleProjSubmit = () => {
    if (!match) return
    const result = addProjectionRecord(match.id, projTeamName, projRound, projFuel, projNote)
    if (result.success) {
      setProjMsg({ type: "success", text: result.message })
      setProjTeamName("")
      setProjRound(1)
      setProjFuel("")
      setProjNote("")
      setTimeout(() => setProjMsg(null), 2500)
    } else {
      setProjMsg({ type: "error", text: result.message })
    }
  }

  return (
    <div className="min-h-screen bg-space-900 font-body">
      <header className="flex items-center justify-between px-6 py-4 border-b border-space-600/50">
        <div className="flex items-center gap-3">
          <Rocket className="w-7 h-7 text-flame-500" />
          <h1 className="text-2xl font-display font-bold text-flame-400">火箭燃料配平赛</h1>
        </div>
        <button onClick={() => navigate("/replay")} className="btn-secondary flex items-center gap-2">
          <ChevronRight className="w-4 h-4" /> 回放
        </button>
      </header>

      <div className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!isActive ? (
            <div className="card-glow">
              <h2 className="text-lg font-display text-flame-400 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" /> 创建对局
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label-text">对局名称</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="input-field w-full mt-1" />
                </div>
                <div>
                  <label className="label-text">队伍数量</label>
                  <input type="number" value={teamCount} onChange={e => setTeamCount(+e.target.value)} className="input-field w-full mt-1" />
                </div>
                <div>
                  <label className="label-text">总轮数</label>
                  <input type="number" value={totalRounds} onChange={e => setTotalRounds(+e.target.value)} className="input-field w-full mt-1" />
                </div>
                <div>
                  <label className="label-text">轮次时长(秒)</label>
                  <input type="number" value={roundDurationSec} onChange={e => setRoundDurationSec(+e.target.value)} className="input-field w-full mt-1" />
                </div>
                <div>
                  <label className="label-text">资源上限</label>
                  <input type="number" value={resourceLimit} onChange={e => setResourceLimit(+e.target.value)} className="input-field w-full mt-1" />
                </div>
              </div>
              <button onClick={handleCreate} className="btn-primary mt-4 w-full">创建对局</button>
            </div>
          ) : match && matchData ? (
            <div className="space-y-4 animate-fade-in">
              <div className="card-glow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-display text-white">{match.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      match.status === "playing" ? "bg-ok-500/20 text-ok-400" :
                      match.status === "paused" ? "bg-alert-500/20 text-alert-400" :
                      "bg-flame-500/20 text-flame-400"
                    }`}>{match.status}</span>
                  </div>
                  {match.status === "settled" && (
                    <button onClick={() => navigate(`/match/${match.id}/settlement`)} className="btn-ok text-sm">结算</button>
                  )}
                </div>
                <div className="flex items-center justify-center gap-3 py-4">
                  <Timer className="w-6 h-6 text-flame-400" />
                  <span className="text-5xl font-display font-bold text-white tracking-widest">{fmt(timerSeconds)}</span>
                </div>
                {activeRound && (
                  <p className="text-center text-gray-400 text-sm">第 {activeRound.roundNumber} 轮 / 共 {match.totalRounds} 轮</p>
                )}
                {!activeRound && match.status === "playing" && (
                  <p className="text-center text-gray-400 text-sm">等待开始下一轮</p>
                )}
                <div className="flex items-center justify-center gap-3 mt-4">
                  {match.status === "setup" && (
                    <button onClick={handleStart} className="btn-primary flex items-center gap-2">
                      <Play className="w-4 h-4" /> 开始比赛
                    </button>
                  )}
                  {match.status === "playing" && activeRound && (
                    <>
                      <button onClick={handlePause} className="btn-danger flex items-center gap-2">
                        <Pause className="w-4 h-4" /> 暂停
                      </button>
                      <button onClick={handleEndRound} className="btn-secondary flex items-center gap-2">结束本轮</button>
                    </>
                  )}
                  {match.status === "playing" && !activeRound && (
                    <button onClick={handleStartNextRound} className="btn-primary flex items-center gap-2">
                      <SkipForward className="w-4 h-4" /> 开始下一轮
                    </button>
                  )}
                  {match.status === "paused" && (
                    <button onClick={handleResume} className="btn-ok flex items-center gap-2">
                      <Play className="w-4 h-4" /> 继续
                    </button>
                  )}
                  {(match.status === "settled" || match.status === "locked") && (
                    <button onClick={() => navigate(`/match/${match.id}/settlement`)} className="btn-ok flex items-center gap-2">
                      查看结算
                    </button>
                  )}
                </div>
                {showPauseInput && (
                  <div className="mt-3 flex gap-2">
                    <input value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="暂停原因" className="input-field flex-1" />
                    <button onClick={handlePause} className="btn-danger">确认暂停</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {matchData.teams.map(team => {
                  const tr = activeRound ? matchData.teamRounds.find(t => t.teamId === team.id && t.roundId === activeRound.id) : undefined
                  return (
                    <div key={team.id} className="card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{team.name}</span>
                        <div className="flex gap-1">
                          {team.hasAnomaly && <span className="badge-anomaly">异常</span>}
                          {team.source === "projection_screen" && <span className="badge-projection">投屏</span>}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>总分: <span className="font-mono text-ok-400">{team.totalScore}</span></p>
                        <p>剩余资源: <span className={`font-mono ${(tr?.resourceRemaining ?? match.resourceLimit) < 0 ? "text-alert-400" : "text-white"}`}>{tr?.resourceRemaining ?? match.resourceLimit}</span></p>
                      </div>
                      {activeRound && !tr && (
                        <div className="mt-3 flex gap-2">
                          <input type="number" value={fuelInputs[team.id] ?? ""} onChange={e => setFuelInputs(p => ({ ...p, [team.id]: e.target.value }))} placeholder="燃料选择" className="input-field flex-1 text-sm" />
                          <button onClick={() => handleFuel(team.id)} className="btn-primary text-sm px-3">提交</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {match && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-flame-400" />
                <span className="label-text">投屏控制</span>
              </div>
              <button onClick={() => navigate(`/match/${match.id}`)} className="btn-secondary w-full text-sm mb-2">投屏画面</button>
              <button onClick={() => setShowProjection(true)} className="btn-secondary w-full text-sm flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> 投屏补录
              </button>
            </div>
          )}
          <div className="card">
            <h3 className="label-text mb-3">对局列表</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allMatches.map(md => (
                <button key={md.match.id} onClick={() => setActiveMatchId(md.match.id)} className="w-full text-left px-3 py-2 rounded-lg bg-space-700/50 hover:bg-space-600/50 text-sm text-gray-300 transition-colors flex items-center justify-between">
                  <span>{md.match.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    md.match.status === "playing" ? "bg-ok-500/20 text-ok-400" :
                    md.match.status === "paused" ? "bg-alert-500/20 text-alert-400" :
                    md.match.status === "settled" ? "bg-flame-500/20 text-flame-400" :
                    md.match.status === "locked" ? "bg-ok-500/20 text-ok-400" :
                    "bg-space-600 text-gray-500"
                  }`}>{md.match.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-space-800 border border-alert-500/50 rounded-xl p-6 max-w-md w-full mx-4 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6 text-alert-400" />
              <h3 className="text-lg font-display text-alert-400">异常提醒</h3>
            </div>
            <div className="space-y-2 mb-4">
              {anomalies.map(tr => {
                const team = matchData?.teams.find(t => t.id === tr.teamId)
                const round = matchData?.rounds.find(r => r.id === tr.roundId)
                return (
                  <div key={tr.id} className="bg-space-700/80 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{team?.name} - 第{round?.roundNumber}轮</p>
                      <p className="text-xs text-alert-400 font-mono">{tr.resourceRemaining}</p>
                    </div>
                    <button onClick={() => handleConfirm(tr.id)} className="btn-danger text-xs">确认异常</button>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setDismissedAnomalies(p => { const n = new Set(p); anomalies.forEach(a => n.add(a.id)); return n })} className="btn-secondary w-full">修正</button>
          </div>
        </div>
      )}

      {showProjection && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowProjection(false)}>
          <div className="absolute right-0 top-0 h-full w-80 bg-space-800 border-l border-space-600/50 p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-flame-400">投屏补录</h3>
              <button onClick={() => setShowProjection(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              {projMsg && (
                <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                  projMsg.type === "success"
                    ? "bg-ok-500/20 text-ok-400 border border-ok-500/30"
                    : "bg-alert-500/20 text-alert-400 border border-alert-500/30"
                }`}>
                  {projMsg.type === "success"
                    ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <span>{projMsg.text}</span>
                </div>
              )}
              <div>
                <label className="label-text">队伍名称</label>
                <input
                  value={projTeamName}
                  onChange={e => { setProjTeamName(e.target.value); setProjMsg(null) }}
                  placeholder="例如：红队"
                  className="input-field w-full mt-1"
                />
              </div>
              <div>
                <label className="label-text">轮次</label>
                <input
                  type="number"
                  min={1}
                  value={projRound}
                  onChange={e => { setProjRound(+e.target.value); setProjMsg(null) }}
                  className="input-field w-full mt-1"
                />
              </div>
              <div>
                <label className="label-text">燃料选择</label>
                <input
                  type="number"
                  value={projFuel}
                  onChange={e => { setProjFuel(e.target.value); setProjMsg(null) }}
                  placeholder="输入正数，例如 50"
                  className="input-field w-full mt-1"
                />
              </div>
              <div>
                <label className="label-text">备注</label>
                <input
                  value={projNote}
                  onChange={e => setProjNote(e.target.value)}
                  placeholder="原始备注，原样保留"
                  className="input-field w-full mt-1"
                />
              </div>
              <button onClick={handleProjSubmit} className="btn-primary w-full">提交补录</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
