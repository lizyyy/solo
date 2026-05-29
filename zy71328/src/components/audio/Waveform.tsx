import { useRef, useEffect, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import type { PeakMark, LoudnessData } from '@/types'
import { mockData } from '@/mock/sampleData'
import { cn } from '@/lib/utils'

interface WaveformProps {
  audioId: string
  className?: string
  height?: number
}

export default function Waveform({ audioId, className, height = 200 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState(0)
  const currentTime = useAudioStore((state) => state.currentTime)
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime)
  const audioFile = useAudioStore((state) => state.audioFiles.find((f) => f.id === audioId))
  const duration = audioFile?.duration || 0

  const loudnessData: LoudnessData | undefined = mockData.loudnessData[audioId]
  const peakMarks: PeakMark[] = mockData.peakMarks.filter((p) => p.audioId === audioId)

  const waveformData = loudnessData?.momentaryLufs || []
  const loudnessCurve = loudnessData?.shortTermLufs || []

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !containerRef.current) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = containerRef.current.clientWidth
    const displayHeight = height

    canvas.width = width * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${displayHeight}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, displayHeight)

    const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight)
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.3)')
    gradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.6)')
    gradient.addColorStop(1, 'rgba(0, 240, 255, 0.3)')

    const centerY = displayHeight / 2
    const barCount = Math.floor(width * zoom)
    const step = Math.max(1, Math.floor(waveformData.length / barCount))
    const barWidth = (width / barCount) * 0.8
    const gap = (width / barCount) * 0.2

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(i * step + offset * step)
      if (dataIndex >= waveformData.length) break

      const value = waveformData[dataIndex] || -60
      const normalizedValue = Math.max(0, Math.min(1, (value + 60) / 40))
      const barHeight = normalizedValue * (displayHeight * 0.8)

      const x = i * (barWidth + gap)
      const y = centerY - barHeight / 2

      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth, barHeight)
    }

    if (loudnessCurve.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)'
      ctx.lineWidth = 2

      const curveStep = Math.max(1, Math.floor(loudnessCurve.length / barCount))
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * curveStep + offset * curveStep * (waveformData.length / loudnessCurve.length))
        if (dataIndex >= loudnessCurve.length) break

        const value = loudnessCurve[dataIndex] || -60
        const normalizedValue = Math.max(0, Math.min(1, (value + 60) / 40))
        const x = i * (barWidth + gap) + barWidth / 2
        const y = centerY - (normalizedValue - 0.5) * displayHeight * 0.6

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      ctx.shadowColor = 'rgba(139, 92, 246, 0.8)'
      ctx.shadowBlur = 10
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    peakMarks.forEach((peak) => {
      const x = (peak.time / duration) * width - offset * (width / zoom)
      if (x < 0 || x > width) return

      const pulse = (Math.sin(Date.now() / 200) + 1) / 2
      const radius = 6 + pulse * 4

      ctx.beginPath()
      ctx.arc(x, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = peak.fixed ? 'rgba(34, 197, 94, 0.8)' : 'rgba(249, 115, 22, 0.9)'
      ctx.shadowColor = peak.fixed ? 'rgba(34, 197, 94, 0.8)' : 'rgba(249, 115, 22, 0.9)'
      ctx.shadowBlur = 15 + pulse * 10
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.beginPath()
      ctx.moveTo(x, centerY - radius - 5)
      ctx.lineTo(x, centerY - displayHeight * 0.45)
      ctx.strokeStyle = peak.fixed ? 'rgba(34, 197, 94, 0.6)' : 'rgba(249, 115, 22, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    const playheadX = (currentTime / duration) * width - offset * (width / zoom)
    if (playheadX >= 0 && playheadX <= width) {
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, displayHeight)
      ctx.strokeStyle = 'rgba(0, 240, 255, 1)'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(0, 240, 255, 0.8)'
      ctx.shadowBlur = 10
      ctx.stroke()
      ctx.shadowBlur = 0

      ctx.beginPath()
      ctx.moveTo(playheadX - 6, 0)
      ctx.lineTo(playheadX + 6, 0)
      ctx.lineTo(playheadX, 10)
      ctx.closePath()
      ctx.fillStyle = 'rgba(0, 240, 255, 1)'
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)'
    ctx.font = '11px ui-monospace, monospace'
    ctx.textAlign = 'center'

    const tickCount = 10
    for (let i = 0; i <= tickCount; i++) {
      const time = (i / tickCount) * (duration / zoom) + (offset * duration) / (waveformData.length / step)
      const x = (i / tickCount) * width

      ctx.beginPath()
      ctx.moveTo(x, displayHeight - 15)
      ctx.lineTo(x, displayHeight - 5)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillText(formatTime(time), x, displayHeight - 2)
    }
  }, [waveformData, loudnessCurve, peakMarks, currentTime, duration, zoom, offset, height, formatTime])

  useEffect(() => {
    let animationId: number
    const animate = () => {
      draw()
      animationId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animationId)
  }, [draw])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((prev) => Math.max(1, Math.min(10, prev * delta)))
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const clickTime = (x / rect.width) * (duration / zoom) + (offset * duration) / (waveformData.length / Math.max(1, Math.floor(waveformData.length / Math.floor(rect.width * zoom))))
    setCurrentTime(Math.max(0, Math.min(duration, clickTime)))
  }

  return (
    <div className={cn('bg-bg-secondary rounded-xl border border-border-default overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-default">
        <span className="text-sm text-text-secondary">波形视图</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((prev) => Math.max(1, prev - 0.5))}
            className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-text-muted w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((prev) => Math.min(10, prev + 0.5))}
            className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative cursor-crosshair"
        style={{ height }}
        onWheel={handleWheel}
        onClick={handleClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
