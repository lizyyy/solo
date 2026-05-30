import { create } from "zustand"
import type { WaveCard, SurfboardState, BusinessException, Deduction, HistoryEntry, HistoryAction, ScoreState } from "@/types"
import { synthesizeWave, getTotalAmplitude, MAX_AMPLITUDE } from "@/engine/wave"
import { initSurfboard, CANVAS_Y_MIN, CANVAS_Y_MAX } from "@/engine/physics"
import { computeMatchPercent, computeScore, generateSuggestions, createInitialScore } from "@/engine/score"
import {
  detectPhaseUnitError,
  detectAmplitudeOverflow,
  detectBoundaryCrossing,
  resolveException,
  fixPhaseUnit,
  autoWrapPhase,
  scaleAmplitudes,
} from "@/engine/exceptions"
import { getLevel, WAVE_COLORS } from "@/utils/levels"
import { waveColor } from "@/utils/colors"

let idCounter = 0
function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${++idCounter}`
}

interface GameStore {
  levelId: string
  targetWave: WaveCard[]
  playerWave: WaveCard[]
  surfboard: SurfboardState
  score: ScoreState
  exceptions: BusinessException[]
  activeException: BusinessException | null
  history: HistoryEntry[]
  gameTime: number
  isRunning: boolean
  isComplete: boolean

  startLevel: (levelId: string) => void
  addCard: () => void
  removeCard: (cardId: string) => void
  updateCard: (cardId: string, updates: Partial<WaveCard>) => void
  duplicateCard: (cardId: string) => void
  toggleCardLock: (cardId: string) => void
  updateSurfboard: (newBoard: SurfboardState) => void
  setGameTime: (time: number) => void
  setIsRunning: (running: boolean) => void
  resolveActiveException: (resolution: "AUTO_FIXED" | "MANUAL_FIXED" | "CONFIRMED" | "CANCELLED", fixType?: string) => void
  dismissActiveException: () => void
  checkExceptions: () => void
  recalculateScore: () => void
  resetLevel: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  levelId: "",
  targetWave: [],
  playerWave: [],
  surfboard: initSurfboard(),
  score: createInitialScore(100),
  exceptions: [],
  activeException: null,
  history: [],
  gameTime: 0,
  isRunning: false,
  isComplete: false,

  startLevel: (levelId: string) => {
    const level = getLevel(levelId)
    if (!level) return
    const defaultCard: WaveCard = {
      id: nextId("card"),
      amplitude: 1,
      frequency: 0.5,
      phase: 0,
      phaseUnit: "radian",
      color: waveColor(0),
      locked: false,
    }
    set({
      levelId,
      targetWave: structuredClone(level.targetWave),
      playerWave: [defaultCard],
      surfboard: initSurfboard(),
      score: createInitialScore(level.maxScore),
      exceptions: [],
      activeException: null,
      history: [],
      gameTime: 0,
      isRunning: true,
      isComplete: false,
    })
  },

  addCard: () => {
    const { playerWave } = get()
    const newCard: WaveCard = {
      id: nextId("card"),
      amplitude: 1,
      frequency: 1,
      phase: 0,
      phaseUnit: "radian",
      color: waveColor(playerWave.length),
      locked: false,
    }
    const before = structuredClone(playerWave)
    const after = [...playerWave, newCard]
    const entry: HistoryEntry = {
      id: nextId("hist"),
      timestamp: Date.now(),
      action: "ADD_CARD" as HistoryAction,
      description: `添加波形卡 #${playerWave.length + 1}`,
      beforeSnapshot: before,
      afterSnapshot: structuredClone(after),
      exceptionId: null,
      requiresConfirmation: false,
      confirmedAt: null,
    }
    set({ playerWave: after, history: [...get().history, entry] })
  },

  removeCard: (cardId: string) => {
    const { playerWave } = get()
    const before = structuredClone(playerWave)
    const after = playerWave.filter((c) => c.id !== cardId)
    if (after.length === playerWave.length) return
    const entry: HistoryEntry = {
      id: nextId("hist"),
      timestamp: Date.now(),
      action: "REMOVE_CARD" as HistoryAction,
      description: `删除波形卡`,
      beforeSnapshot: before,
      afterSnapshot: structuredClone(after),
      exceptionId: null,
      requiresConfirmation: false,
      confirmedAt: null,
    }
    set({ playerWave: after, history: [...get().history, entry] })
  },

  updateCard: (cardId: string, updates: Partial<WaveCard>) => {
    const { playerWave, exceptions } = get()
    const before = structuredClone(playerWave)
    const after = playerWave.map((c) => (c.id === cardId ? { ...c, ...updates } : c))
    const changedCard = after.find((c) => c.id === cardId)
    const changedKeys = Object.keys(updates)
    const desc = changedCard
      ? `${changedKeys.join("/")} → ${changedKeys.map((k) => (changedCard as unknown as Record<string, unknown>)[k]).join(", ")}`
      : "参数变更"

    const entry: HistoryEntry = {
      id: nextId("hist"),
      timestamp: Date.now(),
      action: "PARAM_CHANGE" as HistoryAction,
      description: desc,
      beforeSnapshot: before,
      afterSnapshot: structuredClone(after),
      exceptionId: null,
      requiresConfirmation: false,
      confirmedAt: null,
    }
    set({ playerWave: after, history: [...get().history, entry] })
  },

  duplicateCard: (cardId: string) => {
    const { playerWave } = get()
    const source = playerWave.find((c) => c.id === cardId)
    if (!source) return
    const before = structuredClone(playerWave)
    const dup: WaveCard = {
      ...structuredClone(source),
      id: nextId("card"),
      color: waveColor(playerWave.length),
    }
    const after = [...playerWave, dup]
    const entry: HistoryEntry = {
      id: nextId("hist"),
      timestamp: Date.now(),
      action: "ADD_CARD" as HistoryAction,
      description: `复制波形卡`,
      beforeSnapshot: before,
      afterSnapshot: structuredClone(after),
      exceptionId: null,
      requiresConfirmation: false,
      confirmedAt: null,
    }
    set({ playerWave: after, history: [...get().history, entry] })
  },

  toggleCardLock: (cardId: string) => {
    const { playerWave } = get()
    const after = playerWave.map((c) => (c.id === cardId ? { ...c, locked: !c.locked } : c))
    set({ playerWave: after })
  },

  updateSurfboard: (newBoard: SurfboardState) => {
    set({ surfboard: newBoard })
  },

  setGameTime: (time: number) => {
    set({ gameTime: time })
  },

  setIsRunning: (running: boolean) => {
    set({ isRunning: running })
  },

  resolveActiveException: (resolution, fixType) => {
    const { activeException, playerWave } = get()
    if (!activeException) return

    let afterCards = structuredClone(playerWave)

    if (resolution !== "CANCELLED") {
      switch (activeException.type) {
        case "PHASE_UNIT_ERROR": {
          const cardId = activeException.context.parameterName.match(/id: (\w+)/)?.[1]
          if (cardId) {
            if (fixType === "switchUnit") {
              afterCards = fixPhaseUnit(afterCards, cardId)
            } else if (fixType === "autoWrap") {
              afterCards = autoWrapPhase(afterCards, cardId)
            }
          }
          break
        }
        case "AMPLITUDE_OVERFLOW": {
          if (fixType === "scaleDown") {
            afterCards = scaleAmplitudes(afterCards, MAX_AMPLITUDE * 0.9)
          }
          break
        }
        case "BOUNDARY_CROSSING": {
          break
        }
      }
    }

    const resolved = resolveException(activeException, resolution, afterCards)

    const deduction: Deduction | null =
      resolution === "CONFIRMED" && activeException.type === "BOUNDARY_CROSSING"
        ? {
            id: nextId("ded"),
            reason: `确认边界穿越：冲浪板超出安全区域`,
            points: 10,
            relatedExceptionId: activeException.id,
            timestamp: Date.now(),
            parameterSnapshot: structuredClone(playerWave),
          }
        : resolution === "CONFIRMED" && activeException.type === "AMPLITUDE_OVERFLOW"
          ? {
              id: nextId("ded"),
              reason: `确认振幅溢出：叠加振幅超出安全范围`,
              points: 5,
              relatedExceptionId: activeException.id,
              timestamp: Date.now(),
              parameterSnapshot: structuredClone(playerWave),
            }
          : resolution === "CONFIRMED" && activeException.type === "PHASE_UNIT_ERROR"
            ? {
                id: nextId("ded"),
                reason: `确认相位单位异常：相位可能使用错误单位`,
                points: 3,
                relatedExceptionId: activeException.id,
                timestamp: Date.now(),
                parameterSnapshot: structuredClone(playerWave),
              }
            : null

    const historyEntry: HistoryEntry = {
      id: nextId("hist"),
      timestamp: Date.now(),
      action: resolution === "CANCELLED" ? ("EXCEPTION_CANCELLED" as HistoryAction) : ("EXCEPTION_CONFIRMED" as HistoryAction),
      description: `${resolution === "CANCELLED" ? "取消" : "确认"}异常：${activeException.type}`,
      beforeSnapshot: structuredClone(playerWave),
      afterSnapshot: structuredClone(afterCards),
      exceptionId: activeException.id,
      requiresConfirmation: resolution !== "CANCELLED",
      confirmedAt: resolution !== "CANCELLED" ? Date.now() : null,
    }

    const newDeductions = deduction ? [...get().score.deductions, deduction] : get().score.deductions
    const matchPercent = computeMatchPercent(afterCards, get().targetWave, get().gameTime)
    const total = computeScore(matchPercent, get().score.maxScore, newDeductions)
    const suggestions = generateSuggestions(newDeductions, matchPercent)

    set({
      playerWave: afterCards,
      exceptions: [...get().exceptions.filter((e) => e.id !== activeException.id), resolved],
      activeException: null,
      history: [...get().history, historyEntry],
      score: {
        ...get().score,
        total,
        matchPercent,
        deductions: newDeductions,
        suggestions,
      },
    })
  },

  dismissActiveException: () => {
    set({ activeException: null })
  },

  checkExceptions: () => {
    const { playerWave, surfboard } = get()
    const phaseError = detectPhaseUnitError(playerWave)
    if (phaseError) {
      set({ activeException: phaseError, exceptions: [...get().exceptions, phaseError] })
      const entry: HistoryEntry = {
        id: nextId("hist"),
        timestamp: Date.now(),
        action: "EXCEPTION_TRIGGERED" as HistoryAction,
        description: `触发异常：相位单位错误`,
        beforeSnapshot: structuredClone(playerWave),
        afterSnapshot: structuredClone(playerWave),
        exceptionId: phaseError.id,
        requiresConfirmation: true,
        confirmedAt: null,
      }
      set({ history: [...get().history, entry] })
      return
    }
    const amplitudeOverflow = detectAmplitudeOverflow(playerWave)
    if (amplitudeOverflow) {
      set({ activeException: amplitudeOverflow, exceptions: [...get().exceptions, amplitudeOverflow] })
      const entry: HistoryEntry = {
        id: nextId("hist"),
        timestamp: Date.now(),
        action: "EXCEPTION_TRIGGERED" as HistoryAction,
        description: `触发异常：振幅叠加溢出`,
        beforeSnapshot: structuredClone(playerWave),
        afterSnapshot: structuredClone(playerWave),
        exceptionId: amplitudeOverflow.id,
        requiresConfirmation: true,
        confirmedAt: null,
      }
      set({ history: [...get().history, entry] })
      return
    }
    const boundary = detectBoundaryCrossing(surfboard.y, CANVAS_Y_MIN, CANVAS_Y_MAX, playerWave)
    if (boundary) {
      set({ activeException: boundary, exceptions: [...get().exceptions, boundary] })
      const entry: HistoryEntry = {
        id: nextId("hist"),
        timestamp: Date.now(),
        action: "EXCEPTION_TRIGGERED" as HistoryAction,
        description: `触发异常：边界穿越`,
        beforeSnapshot: structuredClone(playerWave),
        afterSnapshot: structuredClone(playerWave),
        exceptionId: boundary.id,
        requiresConfirmation: true,
        confirmedAt: null,
      }
      set({ history: [...get().history, entry] })
    }
  },

  recalculateScore: () => {
    const { playerWave, targetWave, score, gameTime } = get()
    const matchPercent = computeMatchPercent(playerWave, targetWave, gameTime)
    const total = computeScore(matchPercent, score.maxScore, score.deductions)
    const suggestions = generateSuggestions(score.deductions, matchPercent)
    const isComplete = matchPercent >= (getLevel(get().levelId)?.matchThreshold ?? 80)

    set({
      score: { ...score, total, matchPercent, suggestions },
      isComplete,
    })
  },

  resetLevel: () => {
    const { levelId } = get()
    if (levelId) {
      get().startLevel(levelId)
    }
  },
}))
