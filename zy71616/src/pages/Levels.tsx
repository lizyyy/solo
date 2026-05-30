import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { LEVEL_CONFIGS } from '@/utils/constants'
import { Star, Play, User, LogOut, BookOpen, Sparkles, Target, TrendingUp } from 'lucide-react'

const LEVEL_ICONS = {
  superposition: Sparkles,
  measurement: Target,
  bias: TrendingUp,
}

export default function Levels() {
  const navigate = useNavigate()
  const currentUser = useGameStore(s => s.currentUser)
  const allStudents = useGameStore(s => s.allStudents)
  const logout = useGameStore(s => s.logout)
  const enterLevel = useGameStore(s => s.enterLevel)

  const student = allStudents.find(s => s.name === currentUser?.name)

  const getStars = (levelId: string) => {
    if (!student) return 0
    const record = student.records.find(r => r.levelId === levelId && r.passed)
    return record?.stars || 0
  }

  const handleEnterLevel = (levelId: string) => {
    enterLevel(levelId)
    navigate(`/play/${levelId}`)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid noise-overlay" style={{ background: 'var(--bg-deep)' }}>
      <div className="relative z-10 min-h-screen px-6 py-8">
        <header className="flex items-center justify-between mb-10 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-card)' }}>
              <User className="w-6 h-6" style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>欢迎</p>
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{currentUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/record/${currentUser?.name}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition hover:scale-105"
              style={{ background: 'var(--bg-card)', color: 'var(--accent-purple)', borderWidth: 1, borderColor: 'var(--accent-purple)' }}
            >
              <BookOpen className="w-5 h-5" />
              我的记录
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition hover:scale-105"
              style={{ background: 'rgba(255,82,82,0.1)', color: 'var(--error-red)' }}
            >
              <LogOut className="w-5 h-5" />
              退出
            </button>
          </div>
        </header>

        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold glow-text mb-2" style={{ color: 'var(--accent-cyan)' }}>
            选择实验关卡
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>从叠加态开始，一步步探索量子概率的奥秘</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {LEVEL_CONFIGS.map((level, idx) => {
            const LevelIcon = LEVEL_ICONS[level.type]
            const stars = getStars(level.id)
            return (
              <div
                key={level.id}
                className="relative glow-border rounded-2xl p-6 transition-transform hover:scale-105 animate-fade-in-up"
                style={{
                  background: 'var(--bg-card)',
                  animationDelay: `${idx * 0.15}s`,
                  borderColor: stars === 3 ? 'var(--accent-cyan)' : 'var(--border-glow)',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(0,245,212,0.1)' }}>
                    <LevelIcon className="w-8 h-8" style={{ color: 'var(--accent-cyan)' }} />
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(n => (
                      <Star
                        key={n}
                        className="w-5 h-5"
                        style={{
                          color: n <= stars ? 'var(--warning-amber)' : 'var(--text-muted)',
                          fill: n <= stars ? 'var(--warning-amber)' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {level.name}
                </h2>
                <p className="text-sm mb-6 min-h-[3rem]" style={{ color: 'var(--text-secondary)' }}>
                  {level.description}
                </p>

                <div className="space-y-2 mb-6">
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>星级条件</div>
                  <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                    <div>🌟 {level.starConditions.threeStar}</div>
                    <div>⭐ {level.starConditions.twoStar}</div>
                    <div>☆ {level.starConditions.oneStar}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleEnterLevel(level.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-bold transition-transform hover:scale-105 active:scale-95"
                  style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
                >
                  <Play className="w-5 h-5" />
                  {stars > 0 ? '再次挑战' : '开始实验'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
