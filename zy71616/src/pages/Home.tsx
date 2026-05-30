import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { Atom, GraduationCap, LogIn, AlertCircle } from 'lucide-react'

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: Math.random() * 4 + 2,
  delay: Math.random() * 5,
  duration: Math.random() * 3 + 4,
  tx: `${(Math.random() - 0.5) * 60}px`,
  ty: `${(Math.random() - 0.5) * 60}px`,
}))

export default function Home() {
  const navigate = useNavigate()
  const login = useGameStore(s => s.login)

  const [studentName, setStudentName] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [teacherCode, setTeacherCode] = useState('')
  const [error, setError] = useState('')

  const handleStudentLogin = () => {
    if (!studentName.trim()) {
      setError('请输入你的名字')
      return
    }
    const ok = login(studentName.trim(), 'student')
    if (ok) navigate('/levels')
  }

  const handleTeacherLogin = () => {
    if (!teacherName.trim()) {
      setError('请输入教师姓名')
      return
    }
    if (!teacherCode.trim()) {
      setError('请输入教师口令')
      return
    }
    const ok = login(teacherName.trim(), 'teacher', teacherCode.trim())
    if (ok) {
      navigate('/report')
    } else {
      setError('教师口令不正确')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid noise-overlay" style={{ background: 'var(--bg-deep)' }}>
      {PARTICLES.map(p => (
        <span
          key={p.id}
          className="absolute rounded-full animate-float pointer-events-none"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.id % 3 === 0 ? 'var(--accent-cyan)' : 'var(--accent-purple)',
            opacity: 0.5,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--tx': p.tx,
            '--ty': p.ty,
          } as React.CSSProperties}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="animate-float mb-2">
          <Atom className="w-16 h-16" style={{ color: 'var(--accent-cyan)' }} />
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-bold tracking-wider glow-text mb-3" style={{ color: 'var(--accent-cyan)' }}>
          量子骰子概率馆
        </h1>
        <p className="text-lg mb-12" style={{ color: 'var(--text-secondary)' }}>
          探索量子世界的概率奥秘
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
          <div
            className="relative rounded-2xl p-8 animate-pulse-glow"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glow)', borderWidth: 1 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <GraduationCap className="w-8 h-8" style={{ color: 'var(--accent-cyan)' }} />
              <h2 className="font-display text-xl font-bold" style={{ color: 'var(--accent-cyan)' }}>学生入口</h2>
            </div>

            <input
              type="text"
              value={studentName}
              onChange={e => { setStudentName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleStudentLogin()}
              placeholder="输入你的名字"
              className="w-full rounded-lg px-4 py-3 mb-5 text-base outline-none focus:ring-2 transition"
              style={{
                background: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-glow)',
                borderWidth: 1,
                '--tw-ring-color': 'var(--accent-cyan)',
              } as React.CSSProperties}
            />

            <button
              onClick={handleStudentLogin}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-bold text-base transition-transform hover:scale-105 active:scale-95"
              style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
            >
              <LogIn className="w-5 h-5" />
              进入实验
            </button>
          </div>

          <div
            className="relative rounded-2xl p-8 animate-pulse-glow"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--accent-purple)', borderWidth: 1, animationDelay: '1s' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Atom className="w-8 h-8" style={{ color: 'var(--accent-purple)' }} />
              <h2 className="font-display text-xl font-bold" style={{ color: 'var(--accent-purple)' }}>教师入口</h2>
            </div>

            <input
              type="text"
              value={teacherName}
              onChange={e => { setTeacherName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleTeacherLogin()}
              placeholder="输入教师姓名"
              className="w-full rounded-lg px-4 py-3 mb-4 text-base outline-none focus:ring-2 transition"
              style={{
                background: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                borderColor: 'var(--accent-purple)',
                borderWidth: 1,
                '--tw-ring-color': 'var(--accent-purple)',
              } as React.CSSProperties}
            />

            <input
              type="password"
              value={teacherCode}
              onChange={e => { setTeacherCode(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleTeacherLogin()}
              placeholder="输入教师口令"
              className="w-full rounded-lg px-4 py-3 mb-5 text-base outline-none focus:ring-2 transition"
              style={{
                background: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                borderColor: 'var(--accent-purple)',
                borderWidth: 1,
                '--tw-ring-color': 'var(--accent-purple)',
              } as React.CSSProperties}
            />

            <button
              onClick={handleTeacherLogin}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-bold text-base transition-transform hover:scale-105 active:scale-95"
              style={{ background: 'var(--accent-purple)', color: 'var(--bg-deep)' }}
            >
              <LogIn className="w-5 h-5" />
              进入报告
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 px-5 py-3 rounded-lg animate-fade-in-up" style={{ background: 'rgba(255,82,82,0.15)', color: 'var(--error-red)', borderWidth: 1, borderColor: 'var(--error-red)' }}>
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
