import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, RotateCcw, SkipForward, Clock, Zap, Target, Thermometer, ChevronRight, Crosshair, History, Eye, Trash2 } from 'lucide-react'
import { useChallengeStore } from '@/store/challengeStore'
import { ALL_LEVELS } from '@/data/levels'
import { formatElapsed } from '@/engine/challenge'
import type { ChallengeInstance, LevelConfig } from '@/types'

const STATUS_GLOW = { active: 'glow-cyan', paused: 'glow-amber', completed: 'glow-red' } as const
const STATUS_LABEL = { active: '进行中', paused: '已暂停', completed: '已完成', abandoned: '已放弃' } as const
const STATUS_COLOR = { active: 'var(--accent-cyan)', paused: 'var(--accent-amber)', completed: 'var(--accent-green)', abandoned: 'var(--text-muted)' } as const

function HistoryCard({ inst, level, onLoad, onRemove }: { inst: ChallengeInstance; level: LevelConfig | null; onLoad: () => void; onRemove: () => void }) {
  return (
    <div className="card p-4 flex items-center gap-4 animate-slide-up" style={{ borderColor: 'var(--border-dim)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{level?.name ?? inst.levelId}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLOR[inst.status]}18`, color: STATUS_COLOR[inst.status] }}>
            {STATUS_LABEL[inst.status]}
          </span>
        </div>
        <div className="text-xs mt-1 flex gap-3" style={{ color: 'var(--text-muted)' }}>
          <span>回合 {inst.currentRound}/{inst.totalRounds}</span>
          <span>用时 {formatElapsed(inst.elapsedSeconds)}</span>
          <span>{new Date(inst.createdAt).toLocaleString('zh-CN')}</span>
        </div>
      </div>
      <button onClick={onLoad} className="btn-cyan flex items-center gap-1 text-xs shrink-0">
        {inst.status === 'completed' ? <><Eye className="w-3.5 h-3.5" /> 查看</> : <><Play className="w-3.5 h-3.5" /> 继续</>}
      </button>
      <button onClick={onRemove} className="btn-red text-xs p-2 shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function Challenge() {
  const navigate = useNavigate()
  const { instance, records, level, startChallenge, makeChoice, skipChoice, handleTimeout, pause, resume, restart, tick, loadChallenge, getAllArchived } = useChallengeStore()

  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [roundStartElapsed, setRoundStartElapsed] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const prevRound = useRef<number | null>(null)

  useEffect(() => {
    if (!instance || instance.status !== 'active') return
    const id = setInterval(() => tick(), 1000)
    return () => clearInterval(id)
  }, [instance?.status, instance?.id, instance, tick])

  useEffect(() => {
    if (!instance) {
      prevRound.current = null
      return
    }
    if (prevRound.current !== instance.currentRound) {
      setRoundStartElapsed(instance.elapsedSeconds)
      setSelectedChoice(null)
      prevRound.current = instance.currentRound
    }
  }, [instance?.currentRound, instance?.elapsedSeconds, instance])

  useEffect(() => {
    if (!instance) return
    if (prevRound.current === null && records.length > 0) {
      prevRound.current = instance.currentRound
      setRoundStartElapsed(instance.elapsedSeconds)
    }
  }, [instance, records.length])

  useEffect(() => {
    if (!instance || instance.status !== 'active' || !level) return
    const elapsed = instance.elapsedSeconds - roundStartElapsed
    if (elapsed >= level.roundTimeLimit) {
      handleTimeout()
    }
  }, [instance, instance?.elapsedSeconds, instance?.status, roundStartElapsed, level, handleTimeout])

  const handleStart = (levelId: string) => {
    startChallenge(levelId)
  }

  const handleChoice = (choice: string) => {
    if (!instance || instance.status !== 'active') return
    setSelectedChoice(choice)
    makeChoice(choice)
  }

  const archived = getAllArchived()
  const recentArchived = archived.filter(a => a.instance.status !== 'abandoned' || a.records.length > 0).slice(-5).reverse()

  if (!instance || !level) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 animate-fade-in">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-glow-cyan" style={{ color: 'var(--accent-cyan)' }}>电磁炮校准挑战</h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>选择校准等级，开始训练</p>
        </div>
        <div className="grid gap-6 w-full max-w-3xl">
          {ALL_LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => handleStart(l.id)}
              className="card p-6 text-left transition-all hover:scale-[1.02] animate-slide-up group"
              style={{ borderColor: 'var(--border-dim)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{l.name}</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{l.description}</p>
                  <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{l.roundCount} 回合</span>
                    <span>限时 {l.roundTimeLimit}s/回合</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" style={{ color: 'var(--accent-cyan)' }} />
              </div>
            </button>
          ))}
        </div>
        {recentArchived.length > 0 && (
          <div className="w-full max-w-3xl mt-4">
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--accent-cyan)' }}>
              <History className="w-4 h-4" /> {showHistory ? '收起历史' : '历史记录'} ({recentArchived.length})
            </button>
            {showHistory && (
              <div className="space-y-3">
                {recentArchived.map((a) => (
                  <HistoryCard
                    key={a.instance.id}
                    inst={a.instance}
                    level={a.level}
                    onLoad={() => {
                      loadChallenge(a.instance.id)
                      if (a.instance.status === 'completed') {
                        navigate(`/settlement/${a.instance.id}`)
                      }
                    }}
                    onRemove={() => {
                      localStorage.removeItem(`challenge-${a.instance.id}`)
                      const idx = JSON.parse(localStorage.getItem('challenge-index') || '[]')
                      const newIdx = idx.filter((id: string) => id !== a.instance.id)
                      localStorage.setItem('challenge-index', JSON.stringify(newIdx))
                      setShowHistory(false)
                      setShowHistory(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const param = level.parameters.find(p => p.roundNumber === instance.currentRound)
  const options = level.options[instance.currentRound] || []
  const remaining = instance.status === 'active' && level
    ? Math.max(0, level.roundTimeLimit - (instance.elapsedSeconds - roundStartElapsed))
    : 0

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4 animate-fade-in">
      <div className={`card px-4 py-3 flex items-center gap-3 ${STATUS_GLOW[instance.status]}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${instance.status === 'active' ? 'animate-pulse-glow' : ''}`}
          style={{ backgroundColor: STATUS_COLOR[instance.status] }} />
        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{level.name}</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{STATUS_LABEL[instance.status]}</span>
        <span className="ml-auto text-sm font-mono-display" style={{ color: 'var(--text-secondary)' }}>
          回合 {instance.currentRound}/{instance.totalRounds}
        </span>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="card p-4 flex flex-col gap-3 w-20 items-center shrink-0">
          {Array.from({ length: instance.totalRounds }, (_, i) => {
            const r = i + 1
            const rec = records.find(rec => rec.roundNumber === r)
            const isCurrent = r === instance.currentRound && instance.status !== 'completed'
            return (
              <div key={r} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono-display
                  ${isCurrent ? 'glow-cyan animate-pulse-glow' : rec ? '' : ''}`}
                  style={{
                    border: isCurrent ? '2px solid var(--accent-cyan)' : rec ? '2px solid var(--accent-green)' : '2px solid var(--border-dim)',
                    color: isCurrent ? 'var(--accent-cyan)' : rec ? 'var(--accent-green)' : 'var(--text-muted)',
                    backgroundColor: rec && !isCurrent ? 'rgba(76,175,80,0.1)' : 'transparent'
                  }}>
                  {r}
                </div>
                {rec && <span className="text-[10px] font-mono-display" style={{ color: 'var(--accent-green)' }}>{rec.score}</span>}
              </div>
            )
          })}
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="card p-6 animate-slide-up">
            {param ? (
              <div className="grid grid-cols-2 gap-4">
                {([
                  { icon: Zap, label: '频率', value: `${param.frequency} GHz`, desc: '电磁脉冲频率' },
                  { icon: Target, label: '功率', value: `${param.power}%`, desc: '输出功率比' },
                  { icon: Crosshair, label: '角度', value: `${param.angle}°`, desc: '炮管仰角' },
                  { icon: Thermometer, label: '温度', value: `${param.temperature}°C`, desc: '线圈温度' },
                ] as const).map(({ icon: Icon, label, value, desc }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 mt-1 shrink-0" style={{ color: 'var(--accent-cyan)' }} />
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
                      <div className="font-mono-display text-2xl font-bold text-glow-cyan" style={{ color: 'var(--accent-cyan)' }}>{value}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
                {param.extra && (
                  <div className="col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    额外参数: {Object.entries(param.extra).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                {instance.status === 'completed' ? '挑战已完成' : '回合数据不可用'}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 animate-slide-up">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleChoice(opt)}
                disabled={instance.status !== 'active'}
                className={`px-5 py-3 rounded-lg font-mono-display text-sm transition-all
                  ${selectedChoice === opt ? 'glow-cyan border-glow-cyan' : ''}`}
                style={{
                  border: selectedChoice === opt ? '1px solid var(--accent-cyan)' : '1px solid var(--border-dim)',
                  color: selectedChoice === opt ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  backgroundColor: selectedChoice === opt ? 'rgba(0,229,255,0.08)' : 'var(--bg-card)',
                  opacity: instance.status !== 'active' ? 0.5 : 1,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 flex flex-col gap-5 w-36 items-center shrink-0">
          <button
            onClick={instance.status === 'paused' ? resume : pause}
            disabled={instance.status === 'completed'}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all
              ${instance.status === 'active' ? 'glow-cyan' : instance.status === 'paused' ? 'glow-amber' : ''}`}
            style={{
              border: `2px solid ${instance.status === 'paused' ? 'var(--accent-amber)' : 'var(--accent-cyan)'}`,
              color: instance.status === 'paused' ? 'var(--accent-amber)' : 'var(--accent-cyan)',
              opacity: instance.status === 'completed' ? 0.3 : 1,
            }}
          >
            {instance.status === 'paused' ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
          </button>

          <button onClick={restart} className="btn-amber flex items-center gap-2 text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> 重来
          </button>

          <button onClick={skipChoice} disabled={instance.status !== 'active'} className="btn-red flex items-center gap-2 text-xs"
            style={{ opacity: instance.status !== 'active' ? 0.5 : 1 }}>
            <SkipForward className="w-3.5 h-3.5" /> 跳过
          </button>

          <div className="flex flex-col items-center gap-1 mt-2">
            <Clock className="w-5 h-5" style={{ color: remaining <= 5 ? 'var(--accent-red)' : 'var(--accent-cyan)' }} />
            <span className="font-mono-display text-xl font-bold"
              style={{ color: remaining <= 5 ? 'var(--accent-red)' : 'var(--accent-cyan)' }}>
              {instance.status === 'active' ? remaining : '--'}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>剩余秒数</span>
          </div>
        </div>
      </div>

      <div className="card px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Clock className="w-3.5 h-3.5" /> 已用时间
        </div>
        <span className="font-mono-display" style={{ color: 'var(--text-secondary)' }}>{formatElapsed(instance.elapsedSeconds)}</span>
        {instance.status === 'completed' && (
          <button onClick={() => navigate(`/settlement/${instance.id}`)} className="btn-cyan flex items-center gap-2">
            查看结算 <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {instance.status !== 'completed' && <div />}
      </div>
    </div>
  )
}
