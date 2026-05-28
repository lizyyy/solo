import { create } from 'zustand'
import type {
  GameSession, GameEvent, CashTransaction, CustomerOrder,
  PendingShipment, Supplier, InventoryItem, ExchangeRate, RiskRecord,
} from '@/types/game'
import {
  createNewSession, generateEvents, applyEvents, generateOrders,
  processArrivals, checkBacklogRisk, checkExpiredOrders, recoverSuppliers,
  purchaseFromSupplier, emergencyPurchase, deliverOrder, switchSupplier,
  generateReport, createSnapshot,
} from '@/engine/gameEngine'
import { SWITCH_SUPPLIER_COST, MAX_ROUNDS } from '@/data/gameConfig'
import type { ReplayRecord } from '@/types/game'

interface GameState extends GameSession {
  startGame: () => void
  advanceRound: () => void
  endRound: () => void
  doPurchase: (supplierId: string, quantity: number) => boolean
  doEmergencyPurchase: (materialId: string, quantity: number) => boolean
  doDeliverOrder: (orderId: string) => string | null
  doSwitchSupplier: (newSupplierId: string) => string | null
  finishGame: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  ...createNewSession(),

  startGame: () => {
    const session = createNewSession()
    set({ ...session })
  },

  advanceRound: () => {
    const state = get()
    if (state.isFinished || state.isRoundActive) return
    if (state.currentRound >= state.maxRounds) return

    const newRound = state.currentRound + 1

    const recoveredSuppliers = recoverSuppliers(newRound, state.suppliers)

    const { inventory: arrivedInv, arrivedShipments } = processArrivals(
      newRound,
      state.pendingShipments,
      state.inventory,
    )
    const remainingShipments = state.pendingShipments.filter(
      s => !arrivedShipments.find(a => a.id === s.id),
    )

    const newEvents = generateEvents(newRound, recoveredSuppliers, state.exchangeRate)

    const {
      suppliers: eventSuppliers,
      pendingShipments: eventShipments,
      rate: newRate,
      riskRecords: eventRisks,
    } = applyEvents(newEvents, recoveredSuppliers, remainingShipments, state.exchangeRate)

    const mergedShipments = [...eventShipments]

    const newOrders = generateOrders(newRound, newRate)

    const backlogRisks = checkBacklogRisk(arrivedInv, newRound)

    const { orders: checkedOrders, penaltyTotal, penalties } = checkExpiredOrders(
      newRound,
      state.orders,
    )

    const allRisks = [...state.riskRecords, ...eventRisks, ...backlogRisks]
    const allTxns = [...state.cashTransactions, ...penalties]
    const newCash = state.cash - penaltyTotal

    set({
      currentRound: newRound,
      suppliers: eventSuppliers,
      inventory: arrivedInv,
      pendingShipments: mergedShipments,
      events: [...state.events, ...newEvents],
      riskRecords: allRisks,
      cashTransactions: allTxns,
      cash: newCash,
      exchangeRate: newRate,
      orders: [...checkedOrders, ...newOrders],
      isRoundActive: true,
      currentRoundActions: [],
    })
  },

  endRound: () => {
    const state = get()
    if (!state.isRoundActive) return

    const snapshot = createSnapshot(state)
    set({
      isRoundActive: false,
      roundSnapshots: [...state.roundSnapshots, snapshot],
    })
  },

  doPurchase: (supplierId: string, quantity: number) => {
    const state = get()
    if (!state.isRoundActive) return false

    const result = purchaseFromSupplier(
      supplierId, quantity, state.currentRound, state.exchangeRate, state.suppliers,
    )
    if (!result.shipment || !result.transaction) return false
    if (result.cost > state.cash) return false

    set({
      pendingShipments: [...state.pendingShipments, result.shipment],
      cashTransactions: [...state.cashTransactions, result.transaction],
      cash: state.cash - result.cost,
      currentRoundActions: [...state.currentRoundActions, `采购: ${result.transaction.description}`],
    })
    return true
  },

  doEmergencyPurchase: (materialId: string, quantity: number) => {
    const state = get()
    if (!state.isRoundActive) return false

    const result = emergencyPurchase(materialId, quantity, state.currentRound, state.exchangeRate)
    if (result.transaction.amount > state.cash) return false

    set({
      pendingShipments: [...state.pendingShipments, result.shipment],
      cashTransactions: [...state.cashTransactions, result.transaction],
      cash: state.cash - result.transaction.amount,
      currentRoundActions: [...state.currentRoundActions, `紧急采购: ${result.transaction.description}`],
    })
    return true
  },

  doDeliverOrder: (orderId: string) => {
    const state = get()
    if (!state.isRoundActive) return null

    const result = deliverOrder(orderId, state.orders, state.inventory, state.currentRound)
    if (result.error) return result.error

    const txns = result.transaction ? [...state.cashTransactions, result.transaction] : state.cashTransactions
    const revenue = result.transaction?.amount || 0

    set({
      orders: result.orders,
      inventory: result.inventory,
      cashTransactions: txns,
      cash: state.cash + revenue,
      currentRoundActions: [...state.currentRoundActions, `交付: ${result.transaction?.description || orderId}`],
    })
    return null
  },

  doSwitchSupplier: (newSupplierId: string) => {
    const state = get()
    if (!state.isRoundActive) return null
    if (state.cash < SWITCH_SUPPLIER_COST) return '现金不足以支付切换手续费'

    const result = switchSupplier(newSupplierId, state.selectedSupplierId, state.suppliers, state.currentRound)
    if (result.error) return result.error

    set({
      suppliers: result.suppliers,
      selectedSupplierId: newSupplierId,
      cashTransactions: [...state.cashTransactions, result.transaction],
      cash: state.cash - SWITCH_SUPPLIER_COST,
      currentRoundActions: [...state.currentRoundActions, `切换供应商: ${result.transaction.description}`],
    })
    return null
  },

  finishGame: () => {
    let finalState = get()
    if (finalState.isFinished) return

    for (let r = finalState.currentRound + 1; r <= finalState.maxRounds; r++) {
      const { orders: checkedOrders, penaltyTotal, penalties } = checkExpiredOrders(r, finalState.orders)
      if (penaltyTotal > 0) {
        finalState = { ...finalState, orders: checkedOrders, cashTransactions: [...finalState.cashTransactions, ...penalties], cash: finalState.cash - penaltyTotal }
      }
    }

    const report = generateReport(finalState)

    const snapshot = createSnapshot(finalState)
    const snapshots = [...finalState.roundSnapshots, snapshot]

    set({
      isFinished: true,
      report,
      cash: finalState.cash,
      orders: finalState.orders,
      cashTransactions: finalState.cashTransactions,
      roundSnapshots: snapshots,
    })

    const replay: ReplayRecord = {
      sessionId: finalState.id,
      date: new Date().toISOString(),
      finalScore: report.netProfit,
      netProfit: report.netProfit,
      rounds: snapshots,
    }

    const existing = JSON.parse(localStorage.getItem('supply_chain_replays') || '[]')
    existing.push(replay)
    localStorage.setItem('supply_chain_replays', JSON.stringify(existing))
  },
}))
