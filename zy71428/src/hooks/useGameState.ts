import { useReducer, useCallback } from 'react'
import type { GameState, Suspect } from '../types'
import { createSuspects, createClueDeck, shuffleDeck } from '../data/gameData'
import { calculatePosterior } from '../utils/bayesEngine'

type Action =
  | { type: 'START_GAME' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
  | { type: 'DRAW_CLUE' }
  | { type: 'END_GAME' }
  | { type: 'RESET_GAME' }
  | { type: 'TOGGLE_REPLAY' }
  | { type: 'SET_REPLAY_STEP'; step: number }

const initialState: GameState = {
  status: 'idle',
  suspects: [],
  clueDeck: [],
  drawnClues: [],
  inferenceHistory: [],
  currentStep: 0,
  isReplayMode: false,
  revealGuilty: false,
}

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const suspects = createSuspects()
      const clueDeck = shuffleDeck(createClueDeck())
      return {
        ...initialState,
        status: 'playing',
        suspects,
        clueDeck,
      }
    }
    case 'PAUSE_GAME':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state
    case 'RESUME_GAME':
      return state.status === 'paused' ? { ...state, status: 'playing' } : state
    case 'DRAW_CLUE': {
      if (state.status !== 'playing' && state.status !== 'paused') return state
      if (state.clueDeck.length === 0) return state

      const clue = state.clueDeck[0]
      const remainingDeck = state.clueDeck.slice(1)
      const drawnClueIds = state.drawnClues.map((c) => c.id)

      const { updatedSuspects, inferenceStep } = calculatePosterior(
        state.suspects,
        clue,
        drawnClueIds,
        state.inferenceHistory.length + 1,
        state.currentStep + 1
      )

      return {
        ...state,
        suspects: updatedSuspects,
        clueDeck: remainingDeck,
        drawnClues: [...state.drawnClues, clue],
        inferenceHistory: [...state.inferenceHistory, inferenceStep],
        currentStep: state.currentStep + 1,
      }
    }
    case 'END_GAME':
      if (state.status !== 'playing' && state.status !== 'paused') return state
      return {
        ...state,
        status: 'ended',
        revealGuilty: true,
      }
    case 'RESET_GAME':
      return { ...initialState }
    case 'TOGGLE_REPLAY':
      return { ...state, isReplayMode: !state.isReplayMode }
    case 'SET_REPLAY_STEP':
      return { ...state, currentStep: action.step }
    default:
      return state
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const startGame = useCallback(() => dispatch({ type: 'START_GAME' }), [])
  const pauseGame = useCallback(() => dispatch({ type: 'PAUSE_GAME' }), [])
  const resumeGame = useCallback(() => dispatch({ type: 'RESUME_GAME' }), [])
  const drawClue = useCallback(() => dispatch({ type: 'DRAW_CLUE' }), [])
  const endGame = useCallback(() => dispatch({ type: 'END_GAME' }), [])
  const resetGame = useCallback(() => dispatch({ type: 'RESET_GAME' }), [])
  const toggleReplay = useCallback(() => dispatch({ type: 'TOGGLE_REPLAY' }), [])
  const setReplayStep = useCallback(
    (step: number) => dispatch({ type: 'SET_REPLAY_STEP', step }),
    []
  )

  const getGuiltySuspect = useCallback((): Suspect | undefined => {
    return state.suspects.find((s) => s.isGuilty)
  }, [state.suspects])

  const getHighestSuspect = useCallback((): Suspect | undefined => {
    return state.suspects.reduce((max, s) =>
      s.currentProbability > max.currentProbability ? s : max
    , state.suspects[0])
  }, [state.suspects])

  const isCorrectGuess = useCallback((): boolean => {
    const guilty = getGuiltySuspect()
    const highest = getHighestSuspect()
    return guilty !== undefined && highest !== undefined && guilty.id === highest.id
  }, [getGuiltySuspect, getHighestSuspect])

  return {
    state,
    startGame,
    pauseGame,
    resumeGame,
    drawClue,
    endGame,
    resetGame,
    toggleReplay,
    setReplayStep,
    getGuiltySuspect,
    getHighestSuspect,
    isCorrectGuess,
  }
}
