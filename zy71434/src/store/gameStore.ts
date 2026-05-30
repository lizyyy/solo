import { create } from 'zustand'
import type {
  Difficulty,
  GameStatus,
  GameEvent,
  NoteType,
  FeedbackData,
} from '@/types/game'
import { DIFFICULTY_CONFIG, NOTE_ORDER } from '@/types/game'

interface GameState {
  status: GameStatus
  difficulty: Difficulty
  currentRound: number
  totalRounds: number
  score: number
  combo: number
  maxCombo: number
  bpm: number
  sequence: NoteType[]
  currentBeatIndex: number
  events: GameEvent[]
  sessionId: string
  lastFeedback: FeedbackData | null
  showFeedback: boolean
  countdownValue: number
}

interface GameActions {
  startGame: (difficulty: Difficulty) => void
  nextBeat: () => void
  recordEvent: (event: GameEvent) => void
  setFeedback: (feedback: FeedbackData) => void
  clearFeedback: () => void
  endGame: () => void
  resetGame: () => void
  setCountdown: (n: number) => void
  setStatus: (s: GameStatus) => void
}

function generateSequence(length: number): NoteType[] {
  return Array.from({ length }, () =>
    NOTE_ORDER[Math.floor(Math.random() * NOTE_ORDER.length)]
  )
}

const initialState: GameState = {
  status: 'idle',
  difficulty: 'easy',
  currentRound: 1,
  totalRounds: 8,
  score: 0,
  combo: 0,
  maxCombo: 0,
  bpm: 60,
  sequence: [],
  currentBeatIndex: 0,
  events: [],
  sessionId: '',
  lastFeedback: null,
  showFeedback: false,
  countdownValue: 3,
}

export const useGameStore = create<GameState & GameActions>((set) => ({
  ...initialState,

  startGame: (difficulty) => {
    const config = DIFFICULTY_CONFIG[difficulty]
    const sequenceLength = config.sequenceLength * config.beatsPerRound
    set({
      status: 'countdown',
      difficulty,
      currentRound: 1,
      score: 0,
      combo: 0,
      maxCombo: 0,
      bpm: config.bpm,
      sequence: generateSequence(sequenceLength),
      currentBeatIndex: 0,
      events: [],
      sessionId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      lastFeedback: null,
      showFeedback: false,
      countdownValue: 3,
    })
  },

  nextBeat: () =>
    set((state) => {
      const nextIndex = state.currentBeatIndex + 1
      const config = DIFFICULTY_CONFIG[state.difficulty]
      const beatsPerRound = config.beatsPerRound
      if (nextIndex >= beatsPerRound) {
        const nextRound = state.currentRound + 1
        if (nextRound > state.totalRounds) {
          return { status: 'finished' }
        }
        return {
          currentRound: nextRound,
          currentBeatIndex: 0,
          sequence: generateSequence(config.sequenceLength * beatsPerRound),
        }
      }
      return { currentBeatIndex: nextIndex }
    }),

  recordEvent: (event) =>
    set((state) => ({
      events: [...state.events, event],
    })),

  setFeedback: (feedback) =>
    set((state) => {
      const scoreDelta = feedback.type === 'correct' ? 100 + state.combo * 10 : 0
      const newCombo = feedback.type === 'correct' ? state.combo + 1 : 0
      return {
        lastFeedback: feedback,
        showFeedback: true,
        score: state.score + scoreDelta,
        combo: newCombo,
        maxCombo: Math.max(state.maxCombo, newCombo),
      }
    }),

  clearFeedback: () => set({ showFeedback: false }),

  endGame: () => set({ status: 'finished' }),

  resetGame: () => set(initialState),

  setCountdown: (n) => set({ countdownValue: n }),

  setStatus: (s) => set({ status: s }),
}))
