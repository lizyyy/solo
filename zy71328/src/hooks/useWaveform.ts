import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import type { Selection } from '../types'

interface UseWaveformOptions {
  waveformData: number[] | null
  duration: number
  currentTime: number
  selection: Selection | null
  onSelectionChange: (selection: Selection | null) => void
  onSeek: (time: number) => void
}

interface UseWaveformReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>
  zoom: number
  setZoom: (zoom: number) => void
  selection: Selection | null
  handleCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void
}

export function useWaveform({
  waveformData,
  duration,
  currentTime,
  selection: externalSelection,
  onSelectionChange,
  onSeek,
}: UseWaveformOptions): UseWaveformReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const [localSelection, setLocalSelection] = useState<Selection | null>(null)

  const selection = externalSelection ?? localSelection

  const pixelsPerSecond = useMemo(() => {
    const canvas = canvasRef.current
    if (!canvas) return 100
    return (canvas.width * zoom) / Math.max(duration, 1)
  }, [zoom, duration])

  const timeToX = useCallback(
    (time: number): number => {
      const canvas = canvasRef.current
      if (!canvas) return 0
      return (time / Math.max(duration, 1)) * canvas.width * zoom
    },
    [duration, zoom]
  )

  const xToTime = useCallback(
    (x: number): number => {
      const canvas = canvasRef.current
      if (!canvas) return 0
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const canvasX = (x - rect.left) * scaleX
      return Math.max(0, Math.min((canvasX / (canvas.width * zoom)) * Math.max(duration, 1), duration))
    },
    [duration, zoom]
  )

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !waveformData || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    const width = rect.width
    const height = rect.height
    const centerY = height / 2

    ctx.clearRect(0, 0, width, height)

    const visibleStart = 0
    const visibleEnd = Math.min(waveformData.length, Math.ceil(width * zoom))
    const step = Math.max(1, Math.floor((visibleEnd - visibleStart) / width))

    ctx.fillStyle = '#4f46e5'
    ctx.beginPath()
    ctx.moveTo(0, centerY)

    for (let i = 0; i < width; i++) {
      const dataIndex = visibleStart + Math.floor(i * step)
      if (dataIndex < waveformData.length) {
        const amplitude = waveformData[dataIndex]
        const barHeight = amplitude * centerY * 0.9
        ctx.lineTo(i, centerY - barHeight)
      }
    }

    for (let i = width - 1; i >= 0; i--) {
      const dataIndex = visibleStart + Math.floor(i * step)
      if (dataIndex < waveformData.length) {
        const amplitude = waveformData[dataIndex]
        const barHeight = amplitude * centerY * 0.9
        ctx.lineTo(i, centerY + barHeight)
      }
    }

    ctx.closePath()
    ctx.fill()

    if (selection) {
      const selectionStartX = timeToX(selection.start) / zoom
      const selectionEndX = timeToX(selection.end) / zoom
      ctx.fillStyle = 'rgba(79, 70, 229, 0.3)'
      ctx.fillRect(selectionStartX, 0, selectionEndX - selectionStartX, height)
      ctx.strokeStyle = '#4f46e5'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(selectionStartX, 0)
      ctx.lineTo(selectionStartX, height)
      ctx.moveTo(selectionEndX, 0)
      ctx.lineTo(selectionEndX, height)
      ctx.stroke()
    }

    const playheadX = timeToX(currentTime) / zoom
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()
  }, [waveformData, currentTime, selection, zoom, timeToX])

  useEffect(() => {
    drawWaveform()
    const handleResize = () => drawWaveform()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawWaveform])

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const time = xToTime(e.clientX)
      setIsDragging(true)
      setDragStart(time)
      setLocalSelection({ start: time, end: time })
    },
    [xToTime]
  )

  const handleCanvasMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      const time = xToTime(e.clientX)
      const newSelection: Selection = {
        start: Math.min(dragStart, time),
        end: Math.max(dragStart, time),
      }
      setLocalSelection(newSelection)
    },
    [isDragging, dragStart, xToTime]
  )

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    if (localSelection && Math.abs(localSelection.end - localSelection.start) < 0.1) {
      const time = (localSelection.start + localSelection.end) / 2
      onSeek(time)
      setLocalSelection(null)
      onSelectionChange(null)
    } else if (localSelection) {
      onSelectionChange(localSelection)
    }
  }, [isDragging, localSelection, onSeek, onSelectionChange])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) {
        const time = xToTime(e.clientX)
        onSeek(time)
      }
    },
    [isDragging, xToTime, onSeek]
  )

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleCanvasMouseMove)
      window.addEventListener('mouseup', handleCanvasMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove)
      window.removeEventListener('mouseup', handleCanvasMouseUp)
    }
  }, [isDragging, handleCanvasMouseMove, handleCanvasMouseUp])

  const handleCanvasMouseDownWrapper = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      handleCanvasMouseDown(e)
    },
    [handleCanvasMouseDown]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('mousedown', handleCanvasMouseDownWrapper as unknown as EventListener)
    return () => {
      canvas.removeEventListener('mousedown', handleCanvasMouseDownWrapper as unknown as EventListener)
    }
  }, [handleCanvasMouseDownWrapper])

  return {
    canvasRef,
    zoom,
    setZoom,
    selection,
    handleCanvasClick,
  }
}
