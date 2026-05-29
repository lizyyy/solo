import { useState, useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '../store/useAudioStore'

interface UseAudioPlayerReturn {
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  currentTime: number
  duration: number
  isPlaying: boolean
  setGain: (value: number) => void
}

export function useAudioPlayer(audioBuffer: AudioBuffer | null): UseAudioPlayerReturn {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const startTimeRef = useRef(0)
  const pausedAtRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const storeIsPlaying = useAudioStore((state) => state.isPlaying)
  const setStorePlaying = useAudioStore((state) => state.setPlaying)
  const setStoreCurrentTime = useAudioStore((state) => state.setCurrentTime)

  const ensureAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.connect(audioContextRef.current.destination)
      gainNodeRef.current.gain.value = 1
    }
    return audioContextRef.current
  }, [])

  const updateCurrentTime = useCallback(() => {
    if (audioContextRef.current && isPlaying) {
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current
      const newTime = pausedAtRef.current + elapsed
      setCurrentTime(newTime)
      setStoreCurrentTime(newTime)
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime)
    }
  }, [isPlaying, setStoreCurrentTime])

  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration)
    }
  }, [audioBuffer])

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime)
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, updateCurrentTime])

  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch {
          // ignore
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const play = useCallback(async (): Promise<void> => {
    if (!audioBuffer) return

    const audioContext = ensureAudioContext()

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch {
        // ignore
      }
    }

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(gainNodeRef.current!)
    source.onended = () => {
      if (isPlaying) {
        setIsPlaying(false)
        setStorePlaying(false)
        pausedAtRef.current = 0
        setCurrentTime(0)
        setStoreCurrentTime(0)
      }
    }

    const startOffset = pausedAtRef.current
    startTimeRef.current = audioContext.currentTime
    source.start(0, startOffset)
    sourceNodeRef.current = source
    setIsPlaying(true)
    setStorePlaying(true)
  }, [audioBuffer, ensureAudioContext, isPlaying, setStorePlaying, setStoreCurrentTime])

  const pause = useCallback((): void => {
    if (sourceNodeRef.current && isPlaying) {
      try {
        sourceNodeRef.current.stop()
      } catch {
        // ignore
      }
      if (audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current
        pausedAtRef.current = Math.min(pausedAtRef.current + elapsed, duration)
      }
      setIsPlaying(false)
      setStorePlaying(false)
    }
  }, [isPlaying, duration, setStorePlaying])

  const seek = useCallback(
    (time: number): void => {
      const clampedTime = Math.max(0, Math.min(time, duration))
      pausedAtRef.current = clampedTime
      setCurrentTime(clampedTime)
      setStoreCurrentTime(clampedTime)

      if (isPlaying && sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch {
          // ignore
        }
        if (audioContextRef.current && audioBuffer) {
          const source = audioContextRef.current.createBufferSource()
          source.buffer = audioBuffer
          source.connect(gainNodeRef.current!)
          source.onended = () => {
            if (isPlaying) {
              setIsPlaying(false)
              setStorePlaying(false)
              pausedAtRef.current = 0
              setCurrentTime(0)
              setStoreCurrentTime(0)
            }
          }
          startTimeRef.current = audioContextRef.current.currentTime
          source.start(0, clampedTime)
          sourceNodeRef.current = source
        }
      }
    },
    [audioBuffer, duration, isPlaying, setStorePlaying, setStoreCurrentTime]
  )

  const setGain = useCallback((value: number): void => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.max(0, Math.min(value, 2))
    }
  }, [])

  useEffect(() => {
    if (!storeIsPlaying && isPlaying) {
      pause()
    }
  }, [storeIsPlaying, isPlaying, pause])

  return {
    play,
    pause,
    seek,
    currentTime,
    duration,
    isPlaying,
    setGain,
  }
}
