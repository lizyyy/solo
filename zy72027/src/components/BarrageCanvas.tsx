import { useEffect, useRef, useCallback } from 'react'
import type { GameStatus, NoteData } from '@/types'
import { useGameStore } from '@/store/gameStore'

const NOTE_COLORS: Record<string, string> = {
  do: '#8b5cf6',
  re: '#06d6a0',
  mi: '#3b82f6',
  fa: '#f59e0b',
  sol: '#ef4444',
  la: '#ec4899',
  si: '#14b8a6',
}

const LANE_COUNT = 7
const NOTE_HEIGHT = 32
const NOTE_WIDTH = 44
const JUDGE_LINE_OFFSET = 60

interface Props {
  status: GameStatus
  speedMultiplier: number
  onNoteHit: (noteId: string, action: 'hit' | 'miss' | 'wrong') => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

export default function BarrageCanvas({ status, speedMultiplier, onNoteHit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const notesRef = useRef<NoteData[]>([])
  const particlesRef = useRef<Particle[]>([])
  const lastTimeRef = useRef<number>(0)
  const spawnTimerRef = useRef<number>(0)
  const noteIdCounter = useRef<number>(0)
  const noteTypesRef = useRef<string[]>(['do', 're', 'mi', 'fa', 'sol', 'la', 'si'])
  const statusRef = useRef<GameStatus>(status)
  const speedRef = useRef(speedMultiplier)
  const onNoteHitRef = useRef(onNoteHit)
  const keysRef = useRef<Set<string>>(new Set())

  const { spawnNote, removeNote, activeNotes, clearActiveNotes } = useGameStore()

  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { speedRef.current = speedMultiplier }, [speedMultiplier])
  useEffect(() => { onNoteHitRef.current = onNoteHit }, [onNoteHit])

  useEffect(() => {
    notesRef.current = [...activeNotes]
  }, [activeNotes])

  const spawnRandomNote = useCallback(() => {
    const types = noteTypesRef.current
    const type = types[Math.floor(Math.random() * types.length)]
    const lane = Math.floor(Math.random() * LANE_COUNT)
    const id = `note-${++noteIdCounter.current}`
    const note: NoteData = {
      id,
      type,
      lane,
      timestamp: Date.now(),
      speed: (120 + speedRef.current * 60),
    }
    spawnNote(note)
  }, [spawnNote])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (time: number) => {
      const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0.016
      lastTimeRef.current = time

      const w = canvas.width / window.devicePixelRatio
      const h = canvas.height / window.devicePixelRatio

      ctx.clearRect(0, 0, w, h)

      const laneWidth = w / LANE_COUNT
      const judgeY = h - JUDGE_LINE_OFFSET

      for (let i = 0; i < LANE_COUNT; i++) {
        const x = i * laneWidth
        ctx.fillStyle = i % 2 === 0 ? 'rgba(139,92,246,0.03)' : 'rgba(6,214,160,0.03)'
        ctx.fillRect(x, 0, laneWidth, h)
      }

      ctx.strokeStyle = 'rgba(139,92,246,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, judgeY)
      ctx.lineTo(w, judgeY)
      ctx.stroke()

      if (statusRef.current === 'playing') {
        spawnTimerRef.current += dt * 1000
        const interval = Math.max(400, 1200 / speedRef.current)
        if (spawnTimerRef.current >= interval) {
          spawnTimerRef.current = 0
          spawnRandomNote()
        }
      }

      const currentNotes = [...notesRef.current]
      const hitZone = 30

      for (const note of currentNotes) {
        const laneX = note.lane * laneWidth + laneWidth / 2
        const elapsed = (Date.now() - note.timestamp) / 1000
        const noteY = elapsed * note.speed - 40

        if (noteY > judgeY + 50) {
          onNoteHitRef.current(note.id, 'miss')
          removeNote(note.id)
          continue
        }

        const color = NOTE_COLORS[note.type] || '#8b5cf6'
        const inJudge = Math.abs(noteY - judgeY) < hitZone

        ctx.save()
        if (inJudge) {
          ctx.shadowColor = color
          ctx.shadowBlur = 16
        }
        ctx.fillStyle = inJudge ? color : color + 'aa'
        ctx.beginPath()
        const rw = NOTE_WIDTH / 2
        const rh = NOTE_HEIGHT / 2
        ctx.ellipse(laneX, noteY, rw, rh, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = 'bold 12px "Orbitron", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(note.type.toUpperCase(), laneX, noteY)
        ctx.restore()
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]
        p.x += p.vx * dt * 60
        p.y += p.vy * dt * 60
        p.life -= dt * 2
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2 + p.life * 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (statusRef.current !== 'playing') return
      if (keysRef.current.has(e.key)) return
      keysRef.current.add(e.key)

      const keyMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6 }
      const lane = keyMap[e.key]
      if (lane === undefined) return

      const canvasEl = canvasRef.current
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const lw = w / LANE_COUNT
      const jy = h - JUDGE_LINE_OFFSET

      const hitZone = 30
      const closestNote = notesRef.current
        .filter(n => {
          const elapsed = (Date.now() - n.timestamp) / 1000
          const noteY = elapsed * n.speed - 40
          return n.lane === lane && Math.abs(noteY - jy) < hitZone * 3
        })
        .sort((a, b) => Math.abs((Date.now() - a.timestamp)) - Math.abs((Date.now() - b.timestamp)))[0]

      if (!closestNote) return

      const elapsed = (Date.now() - closestNote.timestamp) / 1000
      const noteY = elapsed * closestNote.speed - 40
      const dist = Math.abs(noteY - jy)

      if (dist < hitZone) {
        const action: 'hit' | 'wrong' = Math.random() > 0.15 ? 'hit' : 'wrong'
        onNoteHitRef.current(closestNote.id, action)
        removeNote(closestNote.id)

        const laneX = closestNote.lane * lw + lw / 2
        const color = NOTE_COLORS[closestNote.type] || '#8b5cf6'
        for (let j = 0; j < 8; j++) {
          particlesRef.current.push({
            x: laneX,
            y: jy,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            life: 1,
            color,
          })
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [spawnRandomNote, removeNote, spawnNote])

  useEffect(() => {
    if (status === 'idle') {
      clearActiveNotes()
      spawnTimerRef.current = 0
    }
  }, [status, clearActiveNotes])

  return (
    <div className="relative rounded-xl overflow-hidden border border-purple-900/40 bg-[#080b1f]">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: '420px' }}
      />
      {status === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080b1f]/80">
          <div className="text-center space-y-2">
            <p className="text-lg text-purple-300 font-medium">选择关卡并点击"开始"</p>
            <p className="text-sm text-gray-500">按键盘 1-7 对应 7 条音轨</p>
          </div>
        </div>
      )}
      {status === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080b1f]/70">
          <div className="text-center">
            <p className="text-2xl text-amber-400 font-bold animate-pulse">已暂停</p>
            <p className="text-sm text-gray-500 mt-2">点击"继续"恢复游戏</p>
          </div>
        </div>
      )}
      {status === 'ended' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080b1f]/70">
          <div className="text-center">
            <p className="text-2xl text-purple-300 font-bold">游戏结束</p>
            <p className="text-sm text-gray-500 mt-2">前往"结算"查看成绩</p>
          </div>
        </div>
      )}
    </div>
  )
}
