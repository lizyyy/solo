import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music, Zap, Trophy, Play } from 'lucide-react'
import { useGameStore } from '@/store/gameStore'
import { NOTES, NOTE_ORDER, DIFFICULTY_CONFIG } from '@/types/game'
import type { Difficulty } from '@/types/game'

function StarField() {
  const stars = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 3}s`,
    size: `${2 + Math.random() * 4}px`,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const startGame = useGameStore((s) => s.startGame)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy')
  const [showRules, setShowRules] = useState(false)

  const handleStart = () => {
    startGame(selectedDifficulty)
    navigate('/play')
  }

  return (
    <div className="min-h-screen bg-bg-deep relative overflow-hidden">
      <StarField />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8 gap-8">
        <div className="text-center">
          <h1 className="font-display text-5xl md:text-7xl bg-gradient-to-r from-primary-orange via-primary-purple to-primary-orange bg-clip-text text-transparent animate-float">
            手势魔法音阶战
          </h1>
          <p className="font-body text-white/50 mt-3 text-lg">
            跟着音阶做手势，挑战你的节奏感！
          </p>
        </div>

        {!showRules ? (
          <div className="flex flex-col items-center gap-6 w-full max-w-lg">
            <div className="card-magic w-full">
              <h2 className="font-display text-xl text-primary-orange mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                选择难度
              </h2>
              <div className="flex flex-col gap-3">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => {
                  const config = DIFFICULTY_CONFIG[d]
                  const isSelected = selectedDifficulty === d
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDifficulty(d)}
                      className={`w-full text-left px-5 py-4 rounded-xl transition-all duration-200 flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary-orange/20 border-2 border-primary-orange glow-orange'
                          : 'bg-bg-surface/50 border-2 border-transparent hover:border-white/20'
                      }`}
                    >
                      <div>
                        <span className="font-display text-lg text-white">{config.label}</span>
                        <span className="font-body text-sm text-white/50 ml-3">{config.description}</span>
                      </div>
                      <span className="font-body text-sm text-primary-orange">{config.bpm} BPM</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={handleStart} className="btn-magic btn-magic-orange text-2xl">
              <Play className="w-7 h-7 inline mr-2" />
              开始游戏
            </button>

            <button
              onClick={() => setShowRules(true)}
              className="font-body text-primary-purple hover:text-primary-orange transition-colors underline"
            >
              查看规则与手势说明
            </button>
          </div>
        ) : (
          <div className="card-magic w-full max-w-2xl">
            <h2 className="font-display text-2xl text-primary-orange mb-6 flex items-center gap-2">
              <Music className="w-6 h-6" />
              音阶手势对照表
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
              {NOTE_ORDER.map((note) => {
                const info = NOTES[note]
                return (
                  <div
                    key={note}
                    className="bg-bg-surface/50 rounded-xl p-4 flex flex-col items-center gap-2 border border-white/5"
                  >
                    <span className="font-display text-2xl" style={{ color: info.color }}>
                      {info.label}
                    </span>
                    <span className="text-3xl">{info.emoji}</span>
                    <span className="font-body text-sm text-white/60">{info.description}</span>
                  </div>
                )
              })}
            </div>

            <div className="bg-bg-surface/30 rounded-xl p-4 mb-6">
              <h3 className="font-display text-lg text-primary-purple mb-2">游戏规则</h3>
              <ul className="font-body text-sm text-white/70 space-y-1">
                <li>🎵 屏幕显示音阶卡，跟着节拍做出对应手势</li>
                <li>✓ 手势正确得分，连击加成！</li>
                <li>✗ 手势错误会提示正确做法</li>
                <li>⏱ 超时未做出手势也算失败</li>
                <li>📊 每次判定都保留完整证据，可回放复盘</li>
              </ul>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowRules(false)}
                className="btn-magic btn-magic-orange"
              >
                返回
              </button>
              <button onClick={handleStart} className="btn-magic btn-magic-purple flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                开始挑战
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
