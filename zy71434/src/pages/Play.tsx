import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { useGestureDetection } from '@/components/CameraView'
import ScaleCard from '@/components/ScaleCard'
import BeatBar from '@/components/BeatBar'
import FeedbackPopup from '@/components/FeedbackPopup'
import ScorePanel from '@/components/ScorePanel'
import { audioEngine } from '@/engine/audioEngine'
import { createEvent } from '@/engine/eventLog'
import { NOTES, GESTURE_TO_NOTE, DIFFICULTY_CONFIG } from '@/types/game'
import type { GestureResult, FeedbackType, NoteType } from '@/types/game'

export default function Play() {
  const navigate = useNavigate()
  const {
    status, difficulty, currentRound, totalRounds, score, combo, maxCombo,
    bpm, sequence, currentBeatIndex, events,
    lastFeedback, showFeedback, countdownValue,
    nextBeat, recordEvent, setFeedback, clearFeedback,
    setCountdown, setStatus, endGame,
  } = useGameStore()

  const { videoRef, canvasRef, isReady, lastGesture, startCamera, stopCamera, callbackRef } = useGestureDetection()
  const [beatResults, setBeatResults] = useState<('correct' | 'wrong' | 'timeout')[]>([])
  const beatStartTimeRef = useRef<number>(0)
  const currentGestureRef = useRef<GestureResult | null>(null)
  const [showEventLog, setShowEventLog] = useState(false)
  const gameLoopStartedRef = useRef(false)
  const timeoutRefs = useRef<number[]>([])
  const isRunningRef = useRef(false)

  const config = DIFFICULTY_CONFIG[difficulty]
  const currentNote: NoteType | null = sequence[currentBeatIndex] ?? null

  const clearTimeouts = () => {
    timeoutRefs.current.forEach((id) => clearTimeout(id))
    timeoutRefs.current = []
  }

  const addTimeout = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter((t) => t !== id)
      if (isRunningRef.current) fn()
    }, ms)
    timeoutRefs.current.push(id)
    return id
  }

  const processBeat = (gestureResult: GestureResult | null, beatTime: number) => {
    const state = useGameStore.getState()
    const beatIdx = state.currentBeatIndex
    const note = state.sequence[beatIdx]
    if (!note) return

    const expectedTime = beatStartTimeRef.current
    const offsetMs = beatTime - expectedTime
    const beatWindow = (60 / state.bpm) * 1000
    const isOnBeat = Math.abs(offsetMs) < beatWindow

    const recognizedNote: NoteType | null = gestureResult
      ? GESTURE_TO_NOTE[gestureResult.gesture] ?? null
      : null

    let feedbackType: FeedbackType = 'timeout'
    let message = '时间到！'
    let correctionHint: string | undefined

    if (gestureResult && recognizedNote === note) {
      feedbackType = 'correct'
      message = '太棒了！'
    } else if (gestureResult && recognizedNote !== note) {
      feedbackType = 'wrong'
      message = '再试一次！'
      const expectedInfo = NOTES[note]
      correctionHint = `应该做 ${expectedInfo.emoji} ${expectedInfo.description}`
    } else {
      feedbackType = 'timeout'
      const expectedInfo = NOTES[note]
      correctionHint = `应该做 ${expectedInfo.emoji} ${expectedInfo.description}`
    }

    const event = createEvent({
      sessionId: state.sessionId,
      roundIndex: state.currentRound - 1,
      beatIndex: beatIdx,
      gesture: {
        landmarks: gestureResult?.landmarks ?? [],
        recognizedGesture: gestureResult?.gesture ?? 'fist',
        confidence: gestureResult?.confidence ?? 0,
      },
      scale: {
        expected: note,
        actual: recognizedNote,
        isCorrect: feedbackType === 'correct',
        confidence: gestureResult?.confidence ?? 0,
      },
      beat: {
        expectedTime,
        actualTime: beatTime,
        offsetMs,
        isOnBeat: feedbackType !== 'timeout',
      },
      feedback: {
        type: feedbackType,
        message,
        correctionHint,
      },
    })

    recordEvent(event)
    setFeedback(event.feedback)

    setBeatResults((prev) => {
      const next = [...prev]
      next[beatIdx] = feedbackType
      return next
    })

    if (feedbackType === 'correct') {
      audioEngine.playCorrectSound()
      audioEngine.playNote(NOTES[note].frequency, 0.3)
    } else if (feedbackType === 'wrong') {
      audioEngine.playWrongSound()
    }
  }

  const scheduleNextBeat = () => {
    const state = useGameStore.getState()
    if (state.status !== 'playing') return

    const beatIntervalMs = (60 / state.bpm) * 1000

    audioEngine.playBeatClick()
    beatStartTimeRef.current = performance.now()

    const note = state.sequence[state.currentBeatIndex]
    if (note) {
      audioEngine.playNote(NOTES[note].frequency, 0.3)
    }

    addTimeout(() => {
      const capturedGesture = currentGestureRef.current
      currentGestureRef.current = null
      const captureTime = performance.now()

      processBeat(capturedGesture, captureTime)

      addTimeout(() => {
        clearFeedback()

        const currentState = useGameStore.getState()
        if (currentState.currentBeatIndex >= DIFFICULTY_CONFIG[currentState.difficulty].beatsPerRound - 1
            && currentState.currentRound >= currentState.totalRounds) {
          endGame()
          navigate('/replay')
        } else {
          nextBeat()
          scheduleNextBeat()
        }
      }, 1000)
    }, beatIntervalMs * 0.75)
  }

  useEffect(() => {
    callbackRef.current = (gestureResult: GestureResult) => {
      currentGestureRef.current = gestureResult
    }
  }, [callbackRef])

  useEffect(() => {
    audioEngine.init()
  }, [])

  useEffect(() => {
    if (status === 'countdown') {
      startCamera()
      audioEngine.init()

      let count = 3
      setCountdown(count)

      const interval = setInterval(() => {
        count--
        if (count > 0) {
          setCountdown(count)
          audioEngine.playCountdownBeep()
        } else {
          clearInterval(interval)
          setCountdown(0)
          setStatus('playing')
          audioEngine.playCountdownBeep()
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [status, startCamera, setCountdown, setStatus])

  useEffect(() => {
    if (status === 'playing' && !gameLoopStartedRef.current) {
      gameLoopStartedRef.current = true
      isRunningRef.current = true
      scheduleNextBeat()
    }

    if (status !== 'playing') {
      gameLoopStartedRef.current = false
    }
  }, [status])

  useEffect(() => {
    return () => {
      stopCamera()
      isRunningRef.current = false
      clearTimeouts()
    }
  }, [stopCamera])

  useEffect(() => {
    if (status === 'finished') {
      isRunningRef.current = false
      clearTimeouts()
      navigate('/replay')
    }
  }, [status, navigate])

  if (status === 'idle') {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen bg-bg-deep relative flex flex-col">
      {status === 'countdown' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-deep/90">
          <div className="flex flex-col items-center gap-4">
            <span className="font-display text-9xl text-primary-orange animate-bounce-in">
              {countdownValue}
            </span>
            <span className="font-body text-xl text-white/50">准备开始...</span>
          </div>
        </div>
      )}

      <ScorePanel
        score={score}
        combo={combo}
        maxCombo={maxCombo}
        round={currentRound}
        totalRounds={totalRounds}
      />

      <div className="flex-1 flex gap-4 p-4 pt-20">
        <div className="w-[360px] flex-shrink-0 flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden glow-purple" style={{ minHeight: '270px' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover -scale-x-100"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full -scale-x-100"
              width={640}
              height={480}
            />
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-deep/80">
                <span className="font-body text-lg text-primary-purple animate-pulse">
                  正在启动摄像头...
                </span>
              </div>
            )}
          </div>

          <div className="card-magic">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-white/40">当前手势</span>
              {lastGesture && (
                <span className="font-body text-xs text-primary-orange">
                  {NOTES[GESTURE_TO_NOTE[lastGesture.gesture]]?.emoji}{' '}
                  {NOTES[GESTURE_TO_NOTE[lastGesture.gesture]]?.description}
                </span>
              )}
            </div>
            <div className="w-full h-2 bg-bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-orange rounded-full transition-all duration-300"
                style={{ width: `${(lastGesture?.confidence ?? 0) * 100}%` }}
              />
            </div>
            <span className="font-body text-[10px] text-white/30 mt-1 block">
              置信度: {((lastGesture?.confidence ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 relative">
          <ScaleCard note={currentNote} showHint={true} />

          <FeedbackPopup
            feedback={lastFeedback}
            show={showFeedback}
            expectedNote={currentNote}
          />

          <div className="card-magic">
            <BeatBar
              totalBeats={config.beatsPerRound}
              currentBeat={currentBeatIndex}
              bpm={bpm}
              isPlaying={status === 'playing'}
              results={beatResults}
            />
          </div>

          <button
            onClick={() => setShowEventLog(!showEventLog)}
            className="font-body text-xs text-white/40 hover:text-primary-orange transition-colors text-left"
          >
            {showEventLog ? '收起事件日志 ▲' : '展开事件日志 ▼'}
          </button>

          {showEventLog && (
            <div className="card-magic max-h-48 overflow-y-auto">
              <div className="space-y-1">
                {events.length === 0 ? (
                  <span className="font-body text-xs text-white/30">等待事件...</span>
                ) : (
                  events.slice(-10).map((e) => (
                    <div key={e.id} className="font-body text-xs text-white/50 flex gap-2">
                      <span className={
                        e.feedback.type === 'correct' ? 'text-success' :
                        e.feedback.type === 'wrong' ? 'text-danger' : 'text-yellow-400'
                      }>
                        {e.feedback.type === 'correct' ? '✓' : e.feedback.type === 'wrong' ? '✗' : '⏱'}
                      </span>
                      <span>R{e.roundIndex + 1} B{e.beatIndex + 1}</span>
                      <span>{e.scale.expected} → {e.scale.actual ?? '—'}</span>
                      <span>{e.beat.offsetMs.toFixed(0)}ms</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
