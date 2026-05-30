import { useMemo } from 'react'
import type { DicePhase } from '@/types'
import { Sparkles } from 'lucide-react'

interface QuantumDiceProps {
  phase: DicePhase
  collapsedValue: number | null
  probabilities: number[]
  onMeasure: () => void
  disabled?: boolean
}

const DICE_PIPS: number[][] = [
  [50, 50],
  [25, 25, 75, 75],
  [25, 25, 50, 50, 75, 75],
  [25, 25, 25, 75, 75, 75],
  [25, 25, 25, 75, 75, 75, 50, 50],
  [25, 25, 25, 75, 75, 75, 25, 50, 75, 50],
]

const PARTICLE_COUNT = 12

export default function QuantumDice({ phase, collapsedValue, onMeasure, disabled }: QuantumDiceProps) {
  const isSuperposition = phase === 'superposition'
  const isCollapsing = phase === 'collapsing'

  const particles = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    angle: (i / PARTICLE_COUNT) * Math.PI * 2,
    radius: 60 + Math.random() * 30,
    speed: 0.5 + Math.random() * 0.5,
    size: 3 + Math.random() * 3,
  })), [])

  const showFace = (faceIndex: number) => {
    if (phase === 'superposition') return true
    return collapsedValue === faceIndex
  }

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative w-48 h-48 mb-8">
        {isSuperposition && particles.map(p => (
          <span
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: 'var(--accent-cyan)',
              left: `calc(50% + ${Math.cos(p.angle) * p.radius}px)`,
              top: `calc(50% + ${Math.sin(p.angle) * p.radius}px)`,
              transform: 'translate(-50%, -50%)',
              opacity: 0.6,
              animation: `spin-slow ${p.speed * 8}s linear infinite`,
            }}
          />
        ))}

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative w-32 h-32 perspective-1000"
            style={{
              transformStyle: 'preserve-3d',
              animation: isSuperposition ? 'spin-slow 8s linear infinite' : 'none',
            }}
          >
            {[0, 1, 2, 3, 4, 5].map(face => (
              <div
                key={face}
                className={`absolute w-32 h-32 rounded-2xl flex items-center justify-center transition-opacity duration-300 ${
                  isCollapsing ? 'animate-collapse-flash' : ''
                }`}
                style={{
                  background: showFace(face) ? 'var(--bg-card)' : 'transparent',
                  borderWidth: 2,
                  borderColor: 'var(--border-glow)',
                  opacity: showFace(face) ? (isSuperposition ? 0.7 : 1) : 0,
                  transform: isSuperposition
                    ? `rotateY(${face * 60}deg) translateZ(60px)`
                    : collapsedValue === face
                    ? 'rotateY(0deg) translateZ(0px)'
                    : undefined,
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  boxShadow: collapsedValue === face ? '0 0 30px rgba(0,245,212,0.4)' : 'none',
                }}
              >
                <div className="relative w-20 h-20">
                  {DICE_PIPS[face]?.map((_, i) => (
                    <span
                      key={i}
                      className="absolute w-4 h-4 rounded-full"
                      style={{
                        background: 'var(--accent-cyan)',
                        left: `${(DICE_PIPS[face]![i * 2] ?? 50)}%`,
                        top: `${(DICE_PIPS[face]![i * 2 + 1] ?? 50)}%`,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 6px rgba(0,245,212,0.5)',
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isSuperposition && (
          <div
            className="absolute inset-0 rounded-full animate-pulse-glow pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(0,245,212,0.1) 0%, transparent 70%)',
              transform: 'scale(1.3)',
            }}
          />
        )}
      </div>

      <button
        onClick={onMeasure}
        disabled={disabled}
        className="relative flex items-center gap-2 px-8 py-4 rounded-full font-display font-bold text-lg transition-all animate-pulse-glow hover:scale-105 active:scale-95 disabled:opacity-50"
        style={{
          background: isSuperposition ? 'var(--accent-cyan)' : 'var(--text-muted)',
          color: 'var(--bg-deep)',
        }}
      >
        <Sparkles className="w-6 h-6" />
        {isSuperposition ? '测量' : collapsedValue !== null ? `已坍缩：${collapsedValue + 1}点` : '测量'}
      </button>

      {phase === 'collapsed' && (
        <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          坍缩后的结果不再改变
        </p>
      )}
    </div>
  )
}
