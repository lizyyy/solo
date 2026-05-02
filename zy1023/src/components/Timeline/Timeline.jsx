import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useProject } from '../../context/ProjectContext'
import { formatTimeShort, getTimeFromPixel, getPixelFromTime } from '../../utils/timeUtils'
import { getMarkerType } from '../../constants/markerTypes'
import './Timeline.css'

function Timeline() {
  const { state, dispatch, actions } = useProject()
  const {
    currentTime,
    duration,
    waveform,
    markers,
    selectedMarker,
    zoomLevel,
    scrollOffset,
    audioInfo
  } = state
  
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [draggingMarker, setDraggingMarker] = useState(null)
  
  const visibleDuration = duration / zoomLevel
  const displayWaveform = waveform.length > 0 ? waveform : Array(1000).fill(0.5)
  
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    
    const ctx = canvas.getContext('2d')
    const width = container.clientWidth
    const height = container.clientHeight
    
    canvas.width = width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    
    ctx.clearRect(0, 0, width, height)
    
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, width, height)
    
    const samplesPerPixel = displayWaveform.length / (width * zoomLevel)
    const startSample = Math.floor(scrollOffset * samplesPerPixel * zoomLevel)
    const endSample = Math.floor((scrollOffset + visibleDuration / duration) * displayWaveform.length)
    
    ctx.beginPath()
    ctx.moveTo(0, height)
    
    for (let x = 0; x < width; x++) {
      const sampleIndex = startSample + Math.floor((x / width) * (endSample - startSample))
      const sample = displayWaveform[Math.min(sampleIndex, displayWaveform.length - 1)] || 0.5
      const barHeight = sample * height * 0.8
      
      const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height)
      gradient.addColorStop(0, '#60a5fa')
      gradient.addColorStop(1, '#93c5fd')
      
      ctx.fillStyle = gradient
      ctx.fillRect(x, height - barHeight, 1, barHeight)
    }
    
    ctx.stroke()
  }, [displayWaveform, zoomLevel, scrollOffset, visibleDuration, duration])
  
  const drawTimeRuler = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    
    const ctx = canvas.getContext('2d')
    const width = container.clientWidth
    const rulerHeight = 30
    
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, width, rulerHeight)
    
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, rulerHeight)
    ctx.lineTo(width, rulerHeight)
    ctx.stroke()
    
    const interval = getTimeInterval(visibleDuration)
    const pixelsPerSecond = width / visibleDuration
    
    const firstMarkTime = Math.ceil(scrollOffset / interval) * interval
    
    ctx.strokeStyle = '#d1d5db'
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    
    for (let time = firstMarkTime; time < scrollOffset + visibleDuration; time += interval) {
      const x = ((time - scrollOffset) / visibleDuration) * width
      
      if (time % (interval * 5) === 0) {
        ctx.fillStyle = '#374151'
        ctx.fillText(formatTimeShort(time), x, 12)
        
        ctx.strokeStyle = '#9ca3af'
        ctx.beginPath()
        ctx.moveTo(x, rulerHeight - 15)
        ctx.lineTo(x, rulerHeight)
        ctx.stroke()
      } else {
        ctx.strokeStyle = '#e5e7eb'
        ctx.beginPath()
        ctx.moveTo(x, rulerHeight - 8)
        ctx.lineTo(x, rulerHeight)
        ctx.stroke()
      }
    }
  }, [visibleDuration, scrollOffset])
  
  const getTimeInterval = (visibleTime) => {
    const intervals = [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600]
    const minPixelsPerInterval = 60
    const pixelsPerSecond = 800 / visibleTime
    
    for (const interval of intervals) {
      if (interval * pixelsPerSecond >= minPixelsPerInterval) {
        return interval
      }
    }
    
    return intervals[intervals.length - 1]
  }
  
  useEffect(() => {
    drawWaveform()
    drawTimeRuler()
  }, [drawWaveform, drawTimeRuler])
  
  useEffect(() => {
    const handleResize = () => {
      drawWaveform()
      drawTimeRuler()
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawWaveform, drawTimeRuler])
  
  const handleCanvasClick = useCallback((event) => {
    if (draggingMarker || isDraggingPlayhead) return
    
    const container = containerRef.current
    if (!container || !duration) return
    
    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const rulerHeight = 30
    
    if (event.clientY - rect.top < rulerHeight) return
    
    const clickTime = getTimeFromPixel(x, rect.width, visibleDuration, scrollOffset)
    const clampedTime = Math.max(0, Math.min(duration, clickTime))
    
    dispatch({ type: 'SET_CURRENT_TIME', payload: clampedTime })
  }, [duration, visibleDuration, scrollOffset, draggingMarker, isDraggingPlayhead, dispatch])
  
  const handleCanvasMouseDown = useCallback((event) => {
    const container = containerRef.current
    if (!container || !duration) return
    
    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const rulerHeight = 30
    
    if (y < rulerHeight) return
    
    const playheadX = getPixelFromTime(currentTime, rect.width, visibleDuration, scrollOffset)
    if (Math.abs(x - playheadX) < 10) {
      setIsDraggingPlayhead(true)
      return
    }
    
    for (const marker of markers) {
      const markerX = getPixelFromTime(marker.time, rect.width, visibleDuration, scrollOffset)
      if (Math.abs(x - markerX) < 12) {
        setDraggingMarker(marker.id)
        dispatch({ type: 'SET_SELECTED_MARKER', payload: marker.id })
        return
      }
    }
  }, [currentTime, markers, duration, visibleDuration, scrollOffset, dispatch])
  
  const handleCanvasMouseMove = useCallback((event) => {
    if (!isDraggingPlayhead && !draggingMarker) return
    
    const container = containerRef.current
    if (!container || !duration) return
    
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const newTime = getTimeFromPixel(x, rect.width, visibleDuration, scrollOffset)
    const clampedTime = Math.max(0, Math.min(duration, newTime))
    
    if (isDraggingPlayhead) {
      dispatch({ type: 'SET_CURRENT_TIME', payload: clampedTime })
    } else if (draggingMarker) {
      actions.updateMarker(draggingMarker, { time: clampedTime })
    }
  }, [isDraggingPlayhead, draggingMarker, duration, visibleDuration, scrollOffset, dispatch, actions])
  
  const handleCanvasMouseUp = useCallback(() => {
    setIsDraggingPlayhead(false)
    setDraggingMarker(null)
  }, [])
  
  useEffect(() => {
    if (isDraggingPlayhead || draggingMarker) {
      const handleGlobalMouseMove = (event) => handleCanvasMouseMove(event)
      const handleGlobalMouseUp = () => handleCanvasMouseUp()
      
      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove)
        window.removeEventListener('mouseup', handleGlobalMouseUp)
      }
    }
  }, [isDraggingPlayhead, draggingMarker, handleCanvasMouseMove, handleCanvasMouseUp])
  
  const handleWheel = useCallback((event) => {
    event.preventDefault()
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(1, Math.min(20, zoomLevel * delta))
    
    dispatch({ type: 'SET_ZOOM_LEVEL', payload: newZoom })
    
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseTime = getTimeFromPixel(mouseX, rect.width, visibleDuration, scrollOffset)
      
      const newVisibleDuration = duration / newZoom
      const newScrollOffset = mouseTime - (mouseX / rect.width) * newVisibleDuration
      
      dispatch({
        type: 'SET_SCROLL_OFFSET',
        payload: Math.max(0, Math.min(duration - newVisibleDuration, newScrollOffset))
      })
    }
  }, [zoomLevel, scrollOffset, visibleDuration, duration, dispatch])
  
  const playheadX = duration > 0
    ? getPixelFromTime(currentTime, containerRef.current?.clientWidth || 800, visibleDuration, scrollOffset)
    : 0
  
  return (
    <div className="timeline-container">
      <div className="timeline-toolbar">
        <div className="zoom-controls">
          <span className="zoom-label">缩放:</span>
          <button
            className="zoom-button"
            onClick={() => {
              const newZoom = Math.max(1, zoomLevel * 0.5)
              dispatch({ type: 'SET_ZOOM_LEVEL', payload: newZoom })
            }}
          >
            −
          </button>
          <span className="zoom-value">{zoomLevel.toFixed(1)}x</span>
          <button
            className="zoom-button"
            onClick={() => {
              const newZoom = Math.min(20, zoomLevel * 2)
              dispatch({ type: 'SET_ZOOM_LEVEL', payload: newZoom })
            }}
          >
            +
          </button>
          <button
            className="zoom-reset"
            onClick={() => {
              dispatch({ type: 'SET_ZOOM_LEVEL', payload: 1 })
              dispatch({ type: 'SET_SCROLL_OFFSET', payload: 0 })
            }}
          >
            重置
          </button>
        </div>
        
        <div className="current-time-display">
          <span className="time-label">当前:</span>
          <span className="time-value">{formatTimeShort(currentTime)}</span>
        </div>
      </div>
      
      <div
        ref={containerRef}
        className="timeline-canvas-container"
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="timeline-canvas" />
        
        <div
          className="playhead"
          style={{ left: `${playheadX}px` }}
        >
          <div className="playhead-head" />
          <div className="playhead-line" />
        </div>
        
        {markers.map((marker) => {
          const markerType = getMarkerType(marker.type)
          const markerX = getPixelFromTime(marker.time, containerRef.current?.clientWidth || 800, visibleDuration, scrollOffset)
          const isSelected = selectedMarker === marker.id
          
          if (markerX < -20 || markerX > (containerRef.current?.clientWidth || 800) + 20) {
            return null
          }
          
          return (
            <div
              key={marker.id}
              className={`marker ${isSelected ? 'marker-selected' : ''} ${draggingMarker === marker.id ? 'marker-dragging' : ''}`}
              style={{
                left: `${markerX}px`,
                '--marker-color': markerType.color,
              }}
              onClick={(e) => {
                e.stopPropagation()
                dispatch({ type: 'SET_SELECTED_MARKER', payload: marker.id })
              }}
            >
              <div className="marker-icon" style={{ backgroundColor: markerType.bgColor, color: markerType.color }}>
                {markerType.icon}
              </div>
              <div
                className="marker-line"
                style={{ backgroundColor: markerType.color }}
              />
            </div>
          )
        })}
      </div>
      
      {!audioInfo && (
        <div className="timeline-hint">
          请先导入音频文件或使用演示数据来开始使用时间轴
        </div>
      )}
    </div>
  )
}

export default Timeline
