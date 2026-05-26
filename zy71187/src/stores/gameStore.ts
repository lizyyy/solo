import { create } from 'zustand'
import type { Level, PlayerAction, ScoreResult, GameHistory } from '@/types'
import { levels, getLevelById } from '@/data/levels'

interface GameState {
  currentLevel: Level | null
  phase: 'menu' | 'playing' | 'paused' | 'result'
  timeRemaining: number
  totalTime: number
  score: number
  matchedAccessories: Record<string, string>
  markedDamages: Record<string, string>
  depositCalculations: Record<string, number>
  identifiedRedHerrings: string[]
  markedNormalWears: string[]
  actionHistory: PlayerAction[]
  lastScoreResult: ScoreResult | null
  gameHistory: GameHistory[]
  selectedEquipmentId: string | null

  startLevel: (levelId: string) => void
  pause: () => void
  resume: () => void
  tick: () => void
  submit: () => void
  matchAccessory: (accessoryId: string, equipmentId: string) => void
  unmatchAccessory: (accessoryId: string) => void
  markDamage: (equipmentId: string, damageId: string) => void
  unmarkDamage: (equipmentId: string) => void
  calculateDeposit: (equipmentId: string, amount: number) => void
  identifyRedHerring: (redHerringId: string) => void
  markNormalWear: (damageId: string) => void
  setSelectedEquipment: (equipmentId: string | null) => void
  reset: () => void
  goToMenu: () => void
  setScoreResult: (result: ScoreResult) => void
  loadHistory: () => void
  saveHistory: (entry: GameHistory) => void
}

const HISTORY_KEY = 'studio-return-game-history'

export const useGameStore = create<GameState>((set, get) => ({
  currentLevel: null,
  phase: 'menu',
  timeRemaining: 0,
  totalTime: 0,
  score: 0,
  matchedAccessories: {},
  markedDamages: {},
  depositCalculations: {},
  identifiedRedHerrings: [],
  markedNormalWears: [],
  actionHistory: [],
  lastScoreResult: null,
  gameHistory: [],
  selectedEquipmentId: null,

  startLevel: (levelId: string) => {
    const level = getLevelById(levelId)
    if (!level) return

    const initialDeposits: Record<string, number> = {}
    level.depositRules.forEach((r) => {
      initialDeposits[r.equipmentId] = r.baseAmount
    })

    set({
      currentLevel: level,
      phase: 'playing',
      timeRemaining: level.timeLimit,
      totalTime: level.timeLimit,
      score: 0,
      matchedAccessories: {},
      markedDamages: {},
      depositCalculations: initialDeposits,
      identifiedRedHerrings: [],
      markedNormalWears: [],
      actionHistory: [],
      lastScoreResult: null,
      selectedEquipmentId: null,
    })
  },

  pause: () => {
    if (get().phase === 'playing') {
      set({ phase: 'paused' })
    }
  },

  resume: () => {
    if (get().phase === 'paused') {
      set({ phase: 'playing' })
    }
  },

  tick: () => {
    const { phase, timeRemaining } = get()
    if (phase === 'playing' && timeRemaining > 0) {
      set({ timeRemaining: timeRemaining - 1 })
    }
  },

  submit: () => {
    const { currentLevel, actionHistory, totalTime, timeRemaining } = get()
    if (!currentLevel) return

    const action: PlayerAction = {
      timestamp: totalTime - timeRemaining,
      actionType: 'submit',
      targetId: 'submit',
    }
    set({
      actionHistory: [...actionHistory, action],
      phase: 'result',
    })
  },

  matchAccessory: (accessoryId: string, equipmentId: string) => {
    const { matchedAccessories, actionHistory, totalTime, timeRemaining, currentLevel } = get()
    if (!currentLevel) return

    const newMatched = { ...matchedAccessories, [accessoryId]: equipmentId }
    const acc = currentLevel.accessories.find((a) => a.id === accessoryId)
    const isCorrect = acc ? acc.equipmentId === equipmentId : false

    set({
      matchedAccessories: newMatched,
      actionHistory: [
        ...actionHistory,
        {
          timestamp: totalTime - timeRemaining,
          actionType: 'match_accessory',
          targetId: accessoryId,
          details: equipmentId,
          isCorrect,
        },
      ],
    })
  },

  unmatchAccessory: (accessoryId: string) => {
    const { matchedAccessories, actionHistory, totalTime, timeRemaining } = get()
    const newMatched = { ...matchedAccessories }
    delete newMatched[accessoryId]

    set({
      matchedAccessories: newMatched,
      actionHistory: [
        ...actionHistory,
        {
          timestamp: totalTime - timeRemaining,
          actionType: 'unmatch_accessory',
          targetId: accessoryId,
        },
      ],
    })
  },

  markDamage: (equipmentId: string, damageId: string) => {
    const { markedDamages, actionHistory, totalTime, timeRemaining, currentLevel } = get()
    if (!currentLevel) return

    const newMarked = { ...markedDamages, [damageId]: equipmentId }
    const dmg = currentLevel.damages.find((d) => d.id === damageId)
    const isCorrect = dmg ? !dmg.isNormalWear : false

    set({
      markedDamages: newMarked,
      actionHistory: [
        ...actionHistory,
        {
          timestamp: totalTime - timeRemaining,
          actionType: 'mark_damage',
          targetId: damageId,
          details: equipmentId,
          isCorrect,
        },
      ],
    })
  },

  unmarkDamage: (equipmentId: string) => {
    const { markedDamages, actionHistory, totalTime, timeRemaining } = get()
    const newMarked = { ...markedDamages }
    const dmgId = Object.keys(newMarked).find((k) => newMarked[k] === equipmentId)
    if (dmgId) delete newMarked[dmgId]

    set({
      markedDamages: newMarked,
      actionHistory: [
        ...actionHistory,
        {
          timestamp: totalTime - timeRemaining,
          actionType: 'unmark_damage',
          targetId: equipmentId,
        },
      ],
    })
  },

  calculateDeposit: (equipmentId: string, amount: number) => {
    const { depositCalculations, actionHistory, totalTime, timeRemaining } = get()

    set({
      depositCalculations: { ...depositCalculations, [equipmentId]: amount },
      actionHistory: [
        ...actionHistory,
        {
          timestamp: totalTime - timeRemaining,
          actionType: 'calculate_deposit',
          targetId: equipmentId,
          details: String(amount),
        },
      ],
    })
  },

  identifyRedHerring: (redHerringId: string) => {
    const { identifiedRedHerrings, actionHistory, totalTime, timeRemaining } = get()
    if (identifiedRedHerrings.includes(redHerringId)) return

    set({
      identifiedRedHerrings: [...identifiedRedHerrings, redHerringId],
      actionHistory: [
        ...actionHistory,
        {
          timestamp: totalTime - timeRemaining,
          actionType: 'identify_red_herring',
          targetId: redHerringId,
          isCorrect: true,
        },
      ],
    })
  },

  markNormalWear: (damageId: string) => {
    const { markedNormalWears, actionHistory, totalTime, timeRemaining } = get()
    if (markedNormalWears.includes(damageId)) return

    set({
      markedNormalWears: [...markedNormalWears, damageId],
      actionHistory: [
        ...actionHistory,
        {
          timestamp: totalTime - timeRemaining,
          actionType: 'mark_normal_wear',
          targetId: damageId,
          isCorrect: true,
        },
      ],
    })
  },

  setSelectedEquipment: (equipmentId: string | null) => {
    set({ selectedEquipmentId: equipmentId })
  },

  reset: () => {
    const { currentLevel } = get()
    if (currentLevel) {
      get().startLevel(currentLevel.id)
    }
  },

  goToMenu: () => {
    set({ phase: 'menu', currentLevel: null, lastScoreResult: null })
  },

  setScoreResult: (result: ScoreResult) => {
    set({ lastScoreResult: result })
  },

  loadHistory: () => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        set({ gameHistory: JSON.parse(stored) })
      }
    } catch {
      set({ gameHistory: [] })
    }
  },

  saveHistory: (entry: GameHistory) => {
    const { gameHistory } = get()
    const newHistory = [entry, ...gameHistory].slice(0, 20)
    set({ gameHistory: newHistory })
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
    } catch {
      // ignore
    }
  },
}))
