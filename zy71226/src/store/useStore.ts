import { create } from 'zustand'
import {
  YieldCurvePoint, Bond, PortfolioPosition, ScenarioAlert,
  PracticeSession, PriceRecord, CurveSnapshot,
  DEFAULT_BONDS, DEFAULT_CURVE, POLICY_EVENTS, Tenor, POLICY_EVENTS as _PE,
} from '@/types'
import {
  calculateBondPrice, calculateMacaulayDuration,
  calculatePortfolioDuration, calculateDurationScore,
} from '@/utils/bondCalc'
import { runAllChecks } from '@/utils/scenarioDetect'

interface WorkshopState {
  curve: YieldCurvePoint[]
  bonds: Bond[]
  positions: PortfolioPosition[]
  targetDuration: number
  alerts: ScenarioAlert[]
  currentSession: PracticeSession | null
  sessions: PracticeSession[]
  priceHistory: PriceRecord[]
  selectedBondId: string | null
  lastEventId: string | null

  setCurveRate: (tenor: Tenor, rate: number) => void
  setWeight: (bondId: string, weight: number) => void
  setTargetDuration: (d: number) => void
  applyPolicyEvent: (eventId: string) => void
  selectBond: (bondId: string | null) => void
  createSession: () => void
  completeSession: () => void
  loadSession: (id: string) => void
  deleteSession: (id: string) => void
  snapshotCurve: () => void
  clearAlerts: () => void
  resetCurve: () => void

  getBondPrice: (bondId: string) => number
  getBondDuration: (bondId: string) => number
  getPortfolioDuration: () => number
  getDurationScore: () => number
  getTotalWeight: () => number
  isInverted: () => boolean
}

function generateBatchName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const existing = loadSessionsFromStorage()
  const monthSessions = existing.filter(s => {
    const d = new Date(s.createdAt)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
  return `${year}年${month}月-第${monthSessions.length + 1}次练习`
}

function loadSessionsFromStorage(): PracticeSession[] {
  try {
    const data = localStorage.getItem('bond-workshop-sessions')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveSessionsToStorage(sessions: PracticeSession[]) {
  try {
    localStorage.setItem('bond-workshop-sessions', JSON.stringify(sessions))
  } catch { /* ignore */ }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

export const useStore = create<WorkshopState>((set, get) => ({
  curve: DEFAULT_CURVE.map(p => ({ ...p })),
  bonds: DEFAULT_BONDS,
  positions: DEFAULT_BONDS.map(b => ({ bondId: b.id, weight: 20 })),
  targetDuration: 5,
  alerts: [],
  currentSession: null,
  sessions: loadSessionsFromStorage(),
  priceHistory: [],
  selectedBondId: null,
  lastEventId: null,

  setCurveRate: (tenor, rate) => {
    set(state => {
      const newCurve = state.curve.map(p =>
        p.tenor === tenor ? { ...p, rate: Math.round(Math.max(0, Math.min(8, rate)) * 100) / 100 } : p
      )
      const newAlerts = runAllChecks(
        newCurve,
        state.positions,
        calculatePortfolioDuration(state.positions, state.bonds, newCurve),
        state.targetDuration
      )
      const newPriceHistory = [...state.priceHistory]
      for (const bond of state.bonds) {
        const price = calculateBondPrice(bond, newCurve)
        newPriceHistory.push({ bondId: bond.id, price, timestamp: Date.now() })
      }

      return { curve: newCurve, alerts: newAlerts, priceHistory: newPriceHistory }
    })
    get().snapshotCurve()
  },

  setWeight: (bondId, weight) => {
    set(state => {
      const newPositions = state.positions.map(p =>
        p.bondId === bondId ? { ...p, weight: Math.round(Math.max(0, Math.min(100, weight)) * 10) / 10 } : p
      )
      const portDur = calculatePortfolioDuration(newPositions, state.bonds, state.curve)
      const newAlerts = runAllChecks(state.curve, newPositions, portDur, state.targetDuration)
      return { positions: newPositions, alerts: newAlerts }
    })
  },

  setTargetDuration: (d) => {
    set(state => {
      const portDur = calculatePortfolioDuration(state.positions, state.bonds, state.curve)
      const newAlerts = runAllChecks(state.curve, state.positions, portDur, d)
      return { targetDuration: d, alerts: newAlerts }
    })
  },

  applyPolicyEvent: (eventId) => {
    const event = POLICY_EVENTS.find(e => e.id === eventId)
    if (!event) return
    set(state => {
      const newCurve = state.curve.map(p => ({
        ...p,
        rate: Math.round(Math.max(0, Math.min(8, p.rate + (event.shifts[p.tenor] || 0))) * 100) / 100,
      }))
      const portDur = calculatePortfolioDuration(state.positions, state.bonds, newCurve)
      const newAlerts = runAllChecks(newCurve, state.positions, portDur, state.targetDuration)
      const newPriceHistory = [...state.priceHistory]
      for (const bond of state.bonds) {
        const price = calculateBondPrice(bond, newCurve)
        newPriceHistory.push({ bondId: bond.id, price, timestamp: Date.now() })
      }
      return { curve: newCurve, alerts: newAlerts, priceHistory: newPriceHistory, lastEventId: eventId }
    })
    get().snapshotCurve()
  },

  selectBond: (bondId) => set({ selectedBondId: bondId }),

  createSession: () => {
    const session: PracticeSession = {
      id: generateId(),
      batchName: generateBatchName(),
      batchDate: new Date().toISOString().split('T')[0],
      curveSnapshots: [{ points: get().curve.map(p => ({ ...p })), timestamp: Date.now() }],
      portfolioHistory: [get().positions.map(p => ({ ...p }))],
      priceHistory: [],
      alerts: [],
      durationScore: get().getDurationScore(),
      targetDuration: get().targetDuration,
      actualDuration: get().getPortfolioDuration(),
      createdAt: Date.now(),
    }
    set({
      currentSession: session,
      curve: DEFAULT_CURVE.map(p => ({ ...p })),
      positions: DEFAULT_BONDS.map(b => ({ bondId: b.id, weight: 20 })),
      alerts: [],
      priceHistory: [],
      lastEventId: null,
    })
  },

  completeSession: () => {
    const session = get().currentSession
    if (!session) return
    const completed: PracticeSession = {
      ...session,
      completedAt: Date.now(),
      durationScore: get().getDurationScore(),
      actualDuration: get().getPortfolioDuration(),
      alerts: [...get().alerts],
      priceHistory: [...get().priceHistory],
    }
    const sessions = [...get().sessions, completed]
    saveSessionsToStorage(sessions)
    set({ sessions, currentSession: null })
  },

  loadSession: (id) => {
    const session = get().sessions.find(s => s.id === id)
    if (!session) return
    const lastSnapshot = session.curveSnapshots[session.curveSnapshots.length - 1]
    const lastPortfolio = session.portfolioHistory[session.portfolioHistory.length - 1]
    set({
      currentSession: { ...session, completedAt: undefined },
      curve: lastSnapshot ? lastSnapshot.points : DEFAULT_CURVE.map(p => ({ ...p })),
      positions: lastPortfolio || DEFAULT_BONDS.map(b => ({ bondId: b.id, weight: 20 })),
      alerts: session.alerts,
      targetDuration: session.targetDuration,
      sessions: get().sessions.filter(s => s.id !== id),
    })
  },

  deleteSession: (id) => {
    const sessions = get().sessions.filter(s => s.id !== id)
    saveSessionsToStorage(sessions)
    set({ sessions })
  },

  snapshotCurve: () => {
    const session = get().currentSession
    if (!session) return
    const snapshot: CurveSnapshot = { points: get().curve.map(p => ({ ...p })), timestamp: Date.now() }
    const portfolio = get().positions.map(p => ({ ...p }))
    const updated: PracticeSession = {
      ...session,
      curveSnapshots: [...session.curveSnapshots, snapshot],
      portfolioHistory: [...session.portfolioHistory, portfolio],
    }
    set({ currentSession: updated })
  },

  clearAlerts: () => set({ alerts: [] }),

  resetCurve: () => {
    set(state => {
      const newCurve = DEFAULT_CURVE.map(p => ({ ...p }))
      const newAlerts = runAllChecks(newCurve, state.positions, calculatePortfolioDuration(state.positions, state.bonds, newCurve), state.targetDuration)
      return { curve: newCurve, alerts: newAlerts }
    })
  },

  getBondPrice: (bondId) => {
    const { bonds, curve } = get()
    const bond = bonds.find(b => b.id === bondId)
    if (!bond) return 100
    return calculateBondPrice(bond, curve)
  },

  getBondDuration: (bondId) => {
    const { bonds, curve } = get()
    const bond = bonds.find(b => b.id === bondId)
    if (!bond) return 0
    return calculateMacaulayDuration(bond, curve)
  },

  getPortfolioDuration: () => {
    const { positions, bonds, curve } = get()
    return calculatePortfolioDuration(positions, bonds, curve)
  },

  getDurationScore: () => {
    const actual = get().getPortfolioDuration()
    const target = get().targetDuration
    return calculateDurationScore(actual, target)
  },

  getTotalWeight: () => {
    return get().positions.reduce((sum, p) => sum + p.weight, 0)
  },

  isInverted: () => {
    const curve = get().curve
    const sorted = [...curve].sort((a, b) => {
      const years: Record<string, number> = { '3M': 0.25, '6M': 0.5, '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10, '30Y': 30 }
      return years[a.tenor] - years[b.tenor]
    })
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].rate > sorted[i + 1].rate) return true
    }
    return false
  },
}))
