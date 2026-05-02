import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useProject } from '../../context/ProjectContext'
import { formatTime } from '../../utils/timeUtils'
import './AudioPlayer.css'

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

function AudioPlayer() {
  const { state, dispatch, actions } = useProject()
  const { currentTime, duration, isPlaying, playbackRate, volume, audioInfo } = state
  
  const audioRef = useRef(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [hoverTime, setHoverTime] = useState(null)
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])
  
  useEffect(() => {
    if (audioRef.current && audioInfo?.isMock) {
      let animationFrame
      let lastTimestamp
      
      const animate = (timestamp) => {
        if (!lastTimestamp) lastTimestamp = timestamp
        const delta = (timestamp - lastTimestamp) / 1000
        lastTimestamp = timestamp
        
        if (isPlaying) {
          const newTime = currentTime + delta * playbackRate
          if (newTime < duration) {
            dispatch({ type: 'SET_CURRENT_TIME', payload: newTime })
            animationFrame = requestAnimationFrame(animate)
          } else {
            dispatch({ type: 'SET_PLAYING', payload: false })
            dispatch({ type: 'SET_CURRENT_TIME', payload: duration })
          }
        }
      }
      
      if (isPlaying && audioInfo?.isMock) {
        lastTimestamp = performance.now()
        animationFrame = requestAnimationFrame(animate)
      }
      
      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame)
        }
      }
    }
  }, [isPlaying, currentTime, duration, playbackRate, dispatch, audioInfo])
  
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    
    const newAudioInfo = {
      id: `audio-${Date.now()}`,
      name: file.name,
      format: file.type,
      size: file.size,
      isMock: false
    }
    
    actions.setAudioInfo(newAudioInfo)
  }, [actions, audioUrl])
  
  const handleAudioLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const newAudioInfo = {
        ...audioInfo,
        duration: audioRef.current.duration,
        sampleRate: audioRef.current.sampleRate || 44100
      }
      actions.setAudioInfo(newAudioInfo)
    }
  }, [audioInfo, actions])
  
  const handleAudioTimeUpdate = useCallback(() => {
    if (audioRef.current && !audioInfo?.isMock) {
      dispatch({ type: 'SET_CURRENT_TIME', payload: audioRef.current.currentTime })
    }
  }, [dispatch, audioInfo])
  
  const handleAudioEnded = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: false })
    dispatch({ type: 'SET_CURRENT_TIME', payload: duration })
  }, [dispatch, duration])
  
  const togglePlay = useCallback(() => {
    if (!audioInfo) return
    
    if (audioRef.current && !audioInfo?.isMock) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    }
    
    dispatch({ type: 'SET_PLAYING', payload: !isPlaying })
  }, [audioInfo, isPlaying, dispatch])
  
  const handleProgressClick = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    const newTime = percent * duration
    
    dispatch({ type: 'SET_CURRENT_TIME', payload: newTime })
    
    if (audioRef.current && !audioInfo?.isMock) {
      audioRef.current.currentTime = newTime
    }
  }, [duration, dispatch, audioInfo])
  
  const handleProgressMouseMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    setHoverTime(percent * duration)
  }, [])
  
  const handleProgressMouseLeave = useCallback(() => {
    setHoverTime(null)
  }, [])
  
  const handlePlaybackRateChange = useCallback((rate) => {
    dispatch({ type: 'SET_PLAYBACK_RATE', payload: rate })
  }, [dispatch])
  
  const handleVolumeChange = useCallback((event) => {
    dispatch({ type: 'SET_VOLUME', payload: parseFloat(event.target.value) })
  }, [dispatch])
  
  const skipTime = useCallback((seconds) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    dispatch({ type: 'SET_CURRENT_TIME', payload: newTime })
    
    if (audioRef.current && !audioInfo?.isMock) {
      audioRef.current.currentTime = newTime
    }
  }, [currentTime, duration, dispatch, audioInfo])
  
  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
      />
      
      <div className="audio-player-header">
        <div className="audio-info">
          {audioInfo ? (
            <div className="audio-info-details">
              <span className="audio-icon">🎵</span>
              <div className="audio-info-text">
                <span className="audio-name">{audioInfo.name}</span>
                <span className="audio-duration">{formatTime(duration)}</span>
              </div>
            </div>
          ) : (
            <div className="no-audio-info">
              <span>请导入音频文件开始使用</span>
            </div>
          )}
        </div>
        
        <label className="upload-button">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="upload-input"
          />
          📂 导入音频
        </label>
      </div>
      
      <div className="progress-container">
        <div
          className="progress-bar"
          onClick={handleProgressClick}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
        >
          <div className="progress-background">
            <div
              className="progress-fill"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>
          <div
            className="progress-thumb"
            style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
          />
          
          {hoverTime !== null && (
            <div
              className="progress-tooltip"
              style={{ left: `${(hoverTime / (duration || 1)) * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>
        
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="controls-container">
        <div className="playback-controls">
          <button
            className="control-button skip-button"
            onClick={() => skipTime(-10)}
            disabled={!audioInfo}
            title="后退10秒"
          >
            ⏪
          </button>
          
          <button
            className="control-button play-button"
            onClick={togglePlay}
            disabled={!audioInfo}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <button
            className="control-button skip-button"
            onClick={() => skipTime(10)}
            disabled={!audioInfo}
            title="前进10秒"
          >
            ⏩
          </button>
        </div>
        
        <div className="settings-controls">
          <div className="playback-rate-control">
            <label>速度:</label>
            <select
              value={playbackRate}
              onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
              className="rate-select"
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </div>
          
          <div className="volume-control">
            <label>🔊</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AudioPlayer
