import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'

export function useGameTimer() {
  const tick = useGameStore((s) => s.tick)
  const session = useGameStore((s) => s.session)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const stopTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsRunning(false)
  }

  const startTimer = () => {
    stopTimer()
    intervalRef.current = window.setInterval(() => {
      tick()
    }, 1000)
    setIsRunning(true)
  }

  useEffect(() => {
    if (session && session.status !== 'playing') {
      stopTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status])

  useEffect(() => {
    return () => {
      stopTimer()
    }
  }, [])

  return { startTimer, stopTimer, isRunning }
}
