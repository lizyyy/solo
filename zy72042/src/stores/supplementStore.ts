import { create } from 'zustand'
import type { GameSession, SupplementRecord, FundHolding } from '@/types'
import { useHistoryStore } from '@/stores/historyStore'
import { FUND_ASSETS } from '@/data/funds'
import { calculatePortfolio } from '@/engine/gameEngine'

const SUPPLEMENT_STORAGE_KEY = 'cafe-supplements'
const BASELINE_STORAGE_KEY = 'cafe-baselines'

export function parseHoldings(value: string): FundHolding[] {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (h: unknown) =>
          typeof h === 'object' &&
          h !== null &&
          'fundId' in (h as Record<string, unknown>) &&
          'ratio' in (h as Record<string, unknown>) &&
          typeof (h as Record<string, unknown>).fundId === 'string' &&
          typeof (h as Record<string, unknown>).ratio === 'number'
      ) as FundHolding[]
    }
    return []
  } catch {
    return []
  }
}

export function serializeHoldings(holdings: FundHolding[]): string {
  return JSON.stringify(holdings)
}

export function formatHoldingsHuman(holdings: FundHolding[]): string {
  if (holdings.length === 0) return '（空持仓）'
  const fundMap = new Map(FUND_ASSETS.map((f) => [f.id, f]))
  return holdings
    .map((h) => {
      const fund = fundMap.get(h.fundId)
      const name = fund?.name ?? h.fundId
      return `${name} ${(h.ratio * 100).toFixed(0)}%`
    })
    .join(' + ')
}

export function recalcAfterHoldingsChange(session: GameSession, newHoldings: FundHolding[]): GameSession {
  const { score, risk } = calculatePortfolio(newHoldings, FUND_ASSETS)
  const updatedStatus = session.status
  return {
    ...session,
    holdings: newHoldings,
    currentScore: score,
    currentRisk: risk,
    status: updatedStatus,
  }
}

function readSupplementsFromStorage(): Record<string, SupplementRecord[]> {
  try {
    const raw = localStorage.getItem(SUPPLEMENT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeSupplementsToStorage(data: Record<string, SupplementRecord[]>) {
  localStorage.setItem(SUPPLEMENT_STORAGE_KEY, JSON.stringify(data))
}

function readBaselinesFromStorage(): Record<string, GameSession> {
  try {
    const raw = localStorage.getItem(BASELINE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeBaselinesToStorage(data: Record<string, GameSession>) {
  localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(data))
}

function applySupplementsToSession(session: GameSession, supplements: SupplementRecord[]): GameSession {
  let updated: GameSession = { ...session }
  for (const sup of supplements) {
    switch (sup.field) {
      case 'score':
        updated.currentScore = Number(sup.valueAfter)
        break
      case 'risk':
        updated.currentRisk = Number(sup.valueAfter)
        break
      case 'holdings': {
        const newHoldings = parseHoldings(sup.valueAfter)
        updated = recalcAfterHoldingsChange(updated, newHoldings)
        break
      }
      case 'failReason':
        updated.failReason = (sup.valueAfter as GameSession['failReason']) ?? null
        break
      case 'status':
        updated.status = sup.valueAfter as GameSession['status']
        break
    }
  }
  return updated
}

interface SupplementState {
  supplements: Record<string, SupplementRecord[]>
  baselines: Record<string, GameSession>

  loadAll: () => void
  addSupplement: (sessionId: string, record: SupplementRecord) => void
  getSupplements: (sessionId: string) => SupplementRecord[]
  getBaselineSnapshot: (sessionId: string) => GameSession | undefined
  saveBaseline: (sessionId: string, session: GameSession) => void
  getSessionWithSupplements: (sessionId: string) => GameSession | undefined
  hasSupplements: (sessionId: string) => boolean
}

export const useSupplementStore = create<SupplementState>((set, get) => ({
  supplements: {},
  baselines: {},

  loadAll() {
    set({
      supplements: readSupplementsFromStorage(),
      baselines: readBaselinesFromStorage(),
    })
  },

  addSupplement(sessionId: string, record: SupplementRecord) {
    const { supplements } = get()
    const updated = { ...supplements }
    const existing = updated[sessionId] ?? []
    updated[sessionId] = [...existing, record]
    writeSupplementsToStorage(updated)
    set({ supplements: updated })

    const { getSessionWithSupplements } = get()
    const updatedSession = getSessionWithSupplements(sessionId)
    if (updatedSession) {
      const saveSession = useHistoryStore.getState().saveSession
      saveSession(updatedSession)
    }
  },

  getSupplements(sessionId: string) {
    return get().supplements[sessionId] ?? []
  },

  getBaselineSnapshot(sessionId: string) {
    return get().baselines[sessionId]
  },

  saveBaseline(sessionId: string, session: GameSession) {
    const { baselines } = get()
    if (baselines[sessionId]) return
    const updated = { ...baselines, [sessionId]: { ...session } }
    writeBaselinesToStorage(updated)
    set({ baselines: updated })
  },

  getSessionWithSupplements(sessionId: string) {
    const rawSession = useHistoryStore.getState().getSession(sessionId)
    if (!rawSession) return undefined
    const supplements = get().getSupplements(sessionId)
    return applySupplementsToSession(rawSession, supplements)
  },

  hasSupplements(sessionId: string) {
    return (get().supplements[sessionId] ?? []).length > 0
  },
}))
