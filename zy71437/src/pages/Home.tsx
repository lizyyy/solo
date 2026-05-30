import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { TrafficCone, Users, Bus, ChevronRight, History, Trophy } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  hard: 'bg-red-500/20 text-red-400',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

const INTERSECTION_LABELS: Record<string, string> = {
  cross: '十字路口',
  T: 'T型路口',
  Y: 'Y型路口',
}

function TrafficLight() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % 3)
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  const colors = [
    { bg: 'bg-red-500', glow: active === 0 ? 'shadow-[0_0_16px_4px_rgba(239,68,68,0.6)]' : 'opacity-30' },
    { bg: 'bg-yellow-500', glow: active === 1 ? 'shadow-[0_0_16px_4px_rgba(234,179,8,0.6)]' : 'opacity-30' },
    { bg: 'bg-emerald-500', glow: active === 2 ? 'shadow-[0_0_16px_4px_rgba(16,185,129,0.6)]' : 'opacity-30' },
  ]

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-900 p-3 border border-slate-700">
      {colors.map((c, i) => (
        <div
          key={i}
          className={`h-6 w-6 rounded-full ${c.bg} ${c.glow} transition-all duration-500`}
        />
      ))}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { playerName, setPlayerName, scenarios, fetchScenarios, startGame, currentGameId, loading } = useGameStore()
  const [redirectScenarioId, setRedirectScenarioId] = useState<string | null>(null)

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  if (redirectScenarioId && currentGameId) {
    return <Navigate to={`/game/${redirectScenarioId}`} replace />
  }

  const handleCardClick = async (scenarioId: string) => {
    if (!playerName.trim()) {
      alert('请先输入你的名字')
      return
    }
    setRedirectScenarioId(scenarioId)
    await startGame(scenarioId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-[#1E293B] text-white">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-16 flex flex-col items-center text-center">
          <div className="mb-6 flex items-center gap-4">
            <TrafficLight />
            <h1 className="text-5xl font-bold tracking-tight">交通信号相位赛</h1>
          </div>
          <p className="mb-8 text-lg text-slate-400">调整信号相位，掌控城市脉搏</p>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="输入你的名字"
            className="w-72 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-center text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
        </div>

        <div className="mb-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => handleCardClick(s.id)}
              disabled={loading}
              className="group flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800 p-5 text-left transition-all duration-200 hover:scale-[1.03] hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{s.name}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_STYLES[s.difficulty]}`}>
                  {DIFFICULTY_LABELS[s.difficulty]}
                </span>
              </div>

              <div className="flex flex-col gap-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <TrafficCone className="h-4 w-4 text-slate-500" />
                  <span>{INTERSECTION_LABELS[s.intersectionType]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>车流量: <span className="font-mono">{s.totalVehicleFlow}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>人流量: <span className="font-mono">{s.totalPedestrianFlow}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Bus className="h-4 w-4 text-slate-500" />
                  <span>公交路线: <span className="font-mono">{s.busRouteCount}</span></span>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-end text-emerald-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <span className="text-sm">开始挑战</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-6 py-2.5 text-sm font-medium transition-colors hover:border-slate-500 hover:bg-slate-700"
          >
            <History className="h-4 w-4" />
            历史战绩
          </button>
          <button
            onClick={() => navigate('/leaderboard')}
            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-6 py-2.5 text-sm font-medium transition-colors hover:border-slate-500 hover:bg-slate-700"
          >
            <Trophy className="h-4 w-4" />
            排行榜
          </button>
        </div>
      </div>
    </div>
  )
}
