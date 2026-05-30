import { create } from 'zustand'
import type {
  Order, ExchangeRate, CabinSlot, Container, LedgerEntry, ReportEntry, RoundSnapshot, GamePhase,
} from '../engine/types'
import { generateRate } from '../engine/rateEngine'
import { generateOrders } from '../engine/orderGenerator'
import { settleRound } from '../engine/settlementEngine'
import { buildReport } from '../engine/reportEngine'
import {
  SCENARIOS, DEFAULT_CABIN_TIERS, TOTAL_ROUNDS, INITIAL_BALANCE, CONTAINER_COUNT, BASE_RATE, TRAP_ROUND,
} from '../data/scenarios'

interface GameState {
  phase: GamePhase
  currentRound: number
  totalRounds: number
  orders: Order[]
  exchangeRates: ExchangeRate[]
  cabinSlots: CabinSlot[]
  containers: Container[]
  ledger: LedgerEntry[]
  reports: ReportEntry[]
  roundSnapshots: RoundSnapshot[]
  balance: number
  initialBalance: number
  replayRound: number | null

  startGame: () => void
  assignOrderToContainer: (orderId: string, containerId: string) => void
  unassignOrder: (orderId: string) => void
  lockCabin: (cabinId: string) => void
  confirmShipment: () => void
  cancelOrder: (orderId: string) => void
  endRound: () => void
  setReplayRound: (round: number | null) => void
  resetGame: () => void
}

function createContainers(count: number): Container[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `CTN-${i + 1}`,
    orderId: null,
    status: 'empty' as const,
  }))
}

function resetCabinSlots(): CabinSlot[] {
  return DEFAULT_CABIN_TIERS.map(s => ({ ...s, usedCapacity: 0, locked: false }))
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'setup',
  currentRound: 0,
  totalRounds: TOTAL_ROUNDS,
  orders: [],
  exchangeRates: [],
  cabinSlots: resetCabinSlots(),
  containers: createContainers(CONTAINER_COUNT),
  ledger: [],
  reports: [],
  roundSnapshots: [],
  balance: INITIAL_BALANCE,
  initialBalance: INITIAL_BALANCE,
  replayRound: null,

  startGame: () => {
    const state = get()
    const round = 1
    const scenario = SCENARIOS[round]
    const firstRate = generateRate(round, BASE_RATE, scenario?.rate)
    const newOrders = generateOrders(round, scenario?.orders?.length ?? 3, TOTAL_ROUNDS, scenario?.orders)

    set({
      phase: 'playing',
      currentRound: round,
      orders: newOrders,
      exchangeRates: [firstRate],
      cabinSlots: resetCabinSlots(),
      containers: createContainers(CONTAINER_COUNT),
      ledger: [],
      reports: [],
      roundSnapshots: [],
      balance: INITIAL_BALANCE,
      replayRound: null,
    })
  },

  assignOrderToContainer: (orderId, containerId) => {
    const state = get()
    const order = state.orders.find(o => o.id === orderId)
    if (!order || order.status !== 'pending') return

    const containersNeeded = order.quantity
    const emptyContainers = state.containers.filter(c => c.status === 'empty')
    if (emptyContainers.length < containersNeeded) return

    const targetIdx = state.containers.findIndex(c => c.id === containerId)
    if (targetIdx === -1) return

    const startIdx = state.containers.findIndex((c, i) => {
      if (i < targetIdx) return false
      let consecutive = 0
      for (let j = i; j < state.containers.length && consecutive < containersNeeded; j++) {
        if (state.containers[j].status === 'empty') consecutive++
        else break
      }
      return consecutive >= containersNeeded
    })

    const updatedContainers = state.containers.map((c, i) => {
      if (i >= (startIdx >= 0 ? startIdx : targetIdx) && i < (startIdx >= 0 ? startIdx : targetIdx) + containersNeeded && c.status === 'empty') {
        return { ...c, orderId, status: 'loaded' as const }
      }
      return c
    })

    const updatedOrders = state.orders.map(o =>
      o.id === orderId ? { ...o, status: 'loaded' as const, assignedContainerId: containerId } : o,
    )

    set({ containers: updatedContainers, orders: updatedOrders })
  },

  unassignOrder: (orderId) => {
    const state = get()
    const updatedContainers = state.containers.map(c =>
      c.orderId === orderId ? { ...c, orderId: null, status: 'empty' as const } : c,
    )
    const updatedOrders = state.orders.map(o =>
      o.id === orderId && o.status === 'loaded' ? { ...o, status: 'pending' as const, assignedContainerId: null } : o,
    )
    set({ containers: updatedContainers, orders: updatedOrders })
  },

  lockCabin: (cabinId) => {
    const state = get()
    const updatedSlots = state.cabinSlots.map(s =>
      s.id === cabinId && !s.locked ? { ...s, locked: true } : s,
    )
    set({ cabinSlots: updatedSlots })
  },

  confirmShipment: () => {
    const state = get()
    if (state.phase !== 'playing') return

    const anyLocked = state.cabinSlots.some(s => s.locked)
    if (!anyLocked) return

    const loadedOrders = state.orders.filter(o => o.status === 'loaded')
    if (loadedOrders.length === 0) return

    const currentRate = state.exchangeRates[state.exchangeRates.length - 1]
    const result = settleRound(
      state.currentRound,
      state.orders,
      state.containers,
      state.cabinSlots,
      currentRate,
      Date.now(),
    )

    const newBalance = result.ledgerEntries.reduce((bal, e) => bal + e.amount, state.balance)

    const snapshot: RoundSnapshot = {
      round: state.currentRound,
      rate: currentRate.rate,
      orders: state.orders.map(o => ({ ...o })),
      containers: state.containers.map(c => ({ ...c })),
      cabinSlots: state.cabinSlots.map(s => ({ ...s })),
      balance: newBalance,
      ledgerEntries: result.ledgerEntries,
    }

    set({
      phase: 'round_end',
      orders: result.updatedOrders,
      containers: result.updatedContainers,
      cabinSlots: result.updatedCabinSlots,
      ledger: [...state.ledger, ...result.ledgerEntries],
      reports: [...state.reports, ...result.reportEntries],
      balance: newBalance,
      roundSnapshots: [...state.roundSnapshots, snapshot],
    })
  },

  cancelOrder: (orderId) => {
    const state = get()
    const order = state.orders.find(o => o.id === orderId)
    if (!order || (order.status !== 'pending' && order.status !== 'loaded')) return

    const penalty = Math.round(order.foreignPrice * 0.3)
    const entry: LedgerEntry = {
      id: `LED-${state.currentRound}-${orderId}-CANCEL`,
      round: state.currentRound,
      type: 'breach_penalty',
      amount: -penalty,
      orderId,
      description: `取消订单违约金（${orderId}，30%）`,
      timestamp: Date.now(),
    }

    const updatedContainers = state.containers.map(c =>
      c.orderId === orderId ? { ...c, orderId: null, status: 'empty' as const } : c,
    )

    const updatedOrders = state.orders.map(o =>
      o.id === orderId ? { ...o, status: 'cancelled' as const, assignedContainerId: null } : o,
    )

    set({
      orders: updatedOrders,
      containers: updatedContainers,
      ledger: [...state.ledger, entry],
      balance: state.balance - penalty,
    })
  },

  endRound: () => {
    const state = get()
    const nextRound = state.currentRound + 1

    if (nextRound > state.totalRounds) {
      const expiredOrders = state.orders.filter(o => o.status === 'pending')
      if (expiredOrders.length > 0) {
        const currentRate = state.exchangeRates[state.exchangeRates.length - 1]
        const result = settleRound(state.currentRound, state.orders, state.containers, state.cabinSlots, currentRate, Date.now())
        const newBalance = result.ledgerEntries.reduce((bal, e) => bal + e.amount, state.balance)
        set({
          phase: 'finished',
          orders: result.updatedOrders,
          ledger: [...state.ledger, ...result.ledgerEntries],
          reports: [...state.reports, ...result.reportEntries],
          balance: newBalance,
        })
      } else {
        set({ phase: 'finished' })
      }
      return
    }

    const scenario = SCENARIOS[nextRound]
    const prevRate = state.exchangeRates[state.exchangeRates.length - 1]?.rate ?? BASE_RATE
    const newRate = generateRate(nextRound, prevRate, scenario?.rate)
    const newOrders = generateOrders(nextRound, scenario?.orders?.length ?? 3, TOTAL_ROUNDS, scenario?.orders)

    const expiredPending = state.orders.filter(o => o.status === 'pending' && o.deadlineRound < nextRound)
    let breachEntries: LedgerEntry[] = []
    let breachReports: ReportEntry[] = []
    let updatedOrders = state.orders.map(o => ({ ...o }))
    let breachBalance = state.balance

    for (const order of expiredPending) {
      const penalty = Math.round(order.foreignPrice * order.breachRate)
      breachEntries.push({
        id: `LED-${nextRound}-${order.id}-EXPIRE`,
        round: nextRound,
        type: 'breach_penalty',
        amount: -penalty,
        orderId: order.id,
        description: `逾期违约金（${order.id}，${(order.breachRate * 100).toFixed(0)}%）`,
        timestamp: Date.now(),
      })
      breachBalance -= penalty
      updatedOrders = updatedOrders.map(o =>
        o.id === order.id ? { ...o, status: 'breached' as const } : o,
      )
      breachReports.push({
        id: `RPT-${nextRound}-${order.id}`,
        round: nextRound,
        orderId: order.id,
        steps: [
          { stage: 'order_selected', description: `订单 ${order.id} 逾期`, value: null },
          { stage: 'breach_checked', description: `违约金 ¥${penalty.toLocaleString()}`, value: -penalty },
          { stage: 'settled', description: `违约损失 ¥${penalty.toLocaleString()}`, value: -penalty },
        ],
        finalProfit: -penalty,
        hasError: true,
        errorTypes: ['breach_penalty_missed'],
      })
    }

    const activeOrders = updatedOrders.filter(o => o.status === 'pending' || o.status === 'loaded')
    const allOrders = [...activeOrders, ...newOrders]

    set({
      phase: 'playing',
      currentRound: nextRound,
      orders: allOrders,
      exchangeRates: [...state.exchangeRates, newRate],
      cabinSlots: resetCabinSlots(),
      containers: createContainers(CONTAINER_COUNT),
      ledger: [...state.ledger, ...breachEntries],
      reports: [...state.reports, ...breachReports],
      balance: breachBalance,
    })
  },

  setReplayRound: (round) => set({ replayRound: round }),

  resetGame: () => set({
    phase: 'setup',
    currentRound: 0,
    orders: [],
    exchangeRates: [],
    cabinSlots: resetCabinSlots(),
    containers: createContainers(CONTAINER_COUNT),
    ledger: [],
    reports: [],
    roundSnapshots: [],
    balance: INITIAL_BALANCE,
    replayRound: null,
  }),
}))

export function getReportData() {
  const state = useGameStore.getState()
  return buildReport(state.reports, state.roundSnapshots, state.balance, state.initialBalance)
}
