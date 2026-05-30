import { create } from 'zustand'
import type {
  PlatformTransaction,
  WithdrawalRecord,
  ForwardContract,
  SettlementPlan,
  ExceptionRecord,
  GapWarning,
  KpiData,
  SpotRate,
} from '../data/types'
import {
  transactions as mockTransactions,
  withdrawals as mockWithdrawals,
  forwardContracts as mockForwardContracts,
  initialSettlementPlans,
  initialExceptions,
  spotRates as mockSpotRates,
} from '../data/mockData'
import { runMatching, type MatchResult } from '../engine/matching'
import { computeKpi, runTrialCalculation, executeBatch, type TrialResult } from '../engine/scheduling'

interface AppState {
  transactions: PlatformTransaction[]
  withdrawals: WithdrawalRecord[]
  forwardContracts: ForwardContract[]
  settlementPlans: SettlementPlan[]
  exceptions: ExceptionRecord[]
  warnings: GapWarning[]
  spotRates: SpotRate[]
  kpi: KpiData
  trialResult: TrialResult | null
  isMatched: boolean
  isExecuted: boolean

  runMatchingEngine: () => void
  runTrial: () => void
  executeBatchPlans: () => void
  markExceptionResolved: (id: string) => void
}

export const useStore = create<AppState>((set, get) => ({
  transactions: mockTransactions,
  withdrawals: mockWithdrawals,
  forwardContracts: mockForwardContracts,
  settlementPlans: initialSettlementPlans,
  exceptions: initialExceptions,
  warnings: [],
  spotRates: mockSpotRates,
  kpi: { totalPendingSettlement: 0, totalForwardLocked: 0, totalUncoveredGap: 0, exceptionCount: 0 },
  trialResult: null,
  isMatched: false,
  isExecuted: false,

  runMatchingEngine: () => {
    const state = get()
    const result: MatchResult = runMatching(
      state.transactions,
      state.forwardContracts,
      state.withdrawals,
      state.spotRates
    )
    const kpi = computeKpi(result.plans, result.exceptions)
    set({
      settlementPlans: result.plans,
      exceptions: result.exceptions,
      forwardContracts: result.updatedContracts,
      warnings: result.warnings,
      kpi,
      isMatched: true,
      isExecuted: false,
      trialResult: null,
    })
  },

  runTrial: () => {
    const state = get()
    const trialResult = runTrialCalculation(state.settlementPlans, state.spotRates)
    set({ trialResult })
  },

  executeBatchPlans: () => {
    const state = get()
    const executedPlans = executeBatch(state.settlementPlans)
    const kpi = computeKpi(executedPlans, state.exceptions)
    set({ settlementPlans: executedPlans, kpi, isExecuted: true })
  },

  markExceptionResolved: (id: string) => {
    set((state) => ({
      exceptions: state.exceptions.map((e) =>
        e.id === id ? { ...e, status: 'resolved' as const } : e
      ),
    }))
  },
}))
