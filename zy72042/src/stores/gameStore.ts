import { create } from 'zustand'
import type {
  GameSession,
  ActionToast,
  ActionRecord,
  ExceptionRecord,
  PauseRecord,
  FundHolding,
} from '@/types'
import { calculatePortfolio, canAddFund, checkGameEnd } from '@/engine/gameEngine'
import { detectMisoperation, detectBoundaryScore, detectDirtyData } from '@/engine/exceptionDetector'
import { FUND_ASSETS } from '@/data/funds'
import { LEVELS } from '@/data/levels'

interface GameState {
  session: GameSession | null
  toasts: ActionToast[]
  actions: ActionRecord[]
  exceptions: ExceptionRecord[]
  timerInterval: number | null

  startGame: (levelId: string) => void
  addFundToPortfolio: (fundId: string, ratio: number) => void
  removeFundFromPortfolio: (fundId: string) => void
  adjustRatio: (fundId: string, delta: number) => void
  pauseGame: (reason: string) => void
  resumeGame: () => void
  tick: () => void
  submitPortfolio: () => void
  checkExceptions: (action?: ActionRecord) => void
  checkForGameEnd: () => void
  dismissToast: (id: string) => void
  resetGame: () => void
}

function pushToast(
  toasts: ActionToast[],
  type: ActionToast['type'],
  message: string,
  detail: string
): ActionToast[] {
  return [
    ...toasts,
    {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      detail,
      timestamp: Date.now(),
    },
  ]
}

function makeActionRecord(
  session: GameSession,
  actionType: ActionRecord['actionType'],
  fundId: string | null,
  deltaRatio: number,
  scoreBefore: number,
  riskBefore: number,
  resourcesBefore: number
): ActionRecord {
  return {
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: session.id,
    actionType,
    fundId,
    deltaRatio,
    scoreBefore,
    scoreAfter: session.currentScore,
    riskBefore,
    riskAfter: session.currentRisk,
    resourcesBefore,
    resourcesAfter: session.remainingResources,
    timestamp: Date.now(),
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  session: null,
  toasts: [],
  actions: [],
  exceptions: [],
  timerInterval: null,

  startGame(levelId: string) {
    const level = LEVELS.find(l => l.id === levelId)
    if (!level) return

    const session: GameSession = {
      id: `session-${Date.now()}`,
      levelId,
      status: 'playing',
      currentScore: 0,
      currentRisk: 0,
      remainingResources: level.initialResources,
      remainingTime: level.timeLimit,
      holdings: [],
      failReason: null,
      failDetail: '',
      startedAt: Date.now(),
      completedAt: null,
      pauseRecords: [],
      actions: [],
      exceptions: [],
    }

    set({
      session,
      toasts: pushToast([], 'info', '游戏开始', `关卡：${level.name}`),
      actions: [],
      exceptions: [],
    })
  },

  addFundToPortfolio(fundId: string, ratio: number) {
    const { session, actions, toasts } = get()
    if (!session || session.status !== 'playing') return

    const level = LEVELS.find(l => l.id === session.levelId)
    if (!level) return

    const check = canAddFund(session, level, fundId, ratio, FUND_ASSETS)
    if (!check.allowed) {
      set({ toasts: pushToast(toasts, 'error', '操作被拒绝', check.reason ?? '未知原因') })
      return
    }

    const scoreBefore = session.currentScore
    const riskBefore = session.currentRisk
    const resourcesBefore = session.remainingResources

    const existing = session.holdings.find(h => h.fundId === fundId)
    let newHoldings: FundHolding[]
    if (existing) {
      newHoldings = session.holdings.map(h =>
        h.fundId === fundId ? { ...h, ratio: h.ratio + ratio } : h
      )
    } else {
      newHoldings = [...session.holdings, { fundId, ratio }]
    }

    const calc = calculatePortfolio(newHoldings, FUND_ASSETS)
    const fund = FUND_ASSETS.find(f => f.id === fundId)
    const cost = ratio * (fund?.costPerUnit ?? 0)

    const updatedSession: GameSession = {
      ...session,
      holdings: newHoldings,
      currentScore: calc.score,
      currentRisk: calc.risk,
      remainingResources: session.remainingResources - cost,
    }

    const action = makeActionRecord(
      updatedSession,
      'drag_in',
      fundId,
      ratio,
      scoreBefore,
      riskBefore,
      resourcesBefore
    )

    set({
      session: updatedSession,
      actions: [...actions, action],
      toasts: pushToast(toasts, 'success', '添加基金', `${fund?.name ?? fundId} 配比 +${(ratio * 100).toFixed(0)}%`),
    })

    get().checkExceptions(action)
    get().checkForGameEnd()
  },

  removeFundFromPortfolio(fundId: string) {
    const { session, actions, toasts } = get()
    if (!session || session.status !== 'playing') return

    const holding = session.holdings.find(h => h.fundId === fundId)
    if (!holding) return

    const scoreBefore = session.currentScore
    const riskBefore = session.currentRisk
    const resourcesBefore = session.remainingResources

    const newHoldings = session.holdings.filter(h => h.fundId !== fundId)
    const calc = calculatePortfolio(newHoldings, FUND_ASSETS)
    const fund = FUND_ASSETS.find(f => f.id === fundId)
    const refund = holding.ratio * (fund?.costPerUnit ?? 0)

    const updatedSession: GameSession = {
      ...session,
      holdings: newHoldings,
      currentScore: calc.score,
      currentRisk: calc.risk,
      remainingResources: session.remainingResources + refund,
    }

    const action = makeActionRecord(
      updatedSession,
      'drag_out',
      fundId,
      -holding.ratio,
      scoreBefore,
      riskBefore,
      resourcesBefore
    )

    set({
      session: updatedSession,
      actions: [...actions, action],
      toasts: pushToast(toasts, 'info', '移除基金', `${fund?.name ?? fundId} 已从组合中移除`),
    })

    get().checkExceptions(action)
    get().checkForGameEnd()
  },

  adjustRatio(fundId: string, delta: number) {
    const { session, actions, toasts } = get()
    if (!session || session.status !== 'playing') return

    const holding = session.holdings.find(h => h.fundId === fundId)
    if (!holding) return

    const newRatio = holding.ratio + delta
    if (newRatio < 0 || newRatio > 1) return

    const scoreBefore = session.currentScore
    const riskBefore = session.currentRisk
    const resourcesBefore = session.remainingResources

    const newHoldings = session.holdings.map(h =>
      h.fundId === fundId ? { ...h, ratio: newRatio } : h
    )

    const calc = calculatePortfolio(newHoldings, FUND_ASSETS)
    const fund = FUND_ASSETS.find(f => f.id === fundId)
    const costDelta = delta * (fund?.costPerUnit ?? 0)

    const updatedSession: GameSession = {
      ...session,
      holdings: newHoldings,
      currentScore: calc.score,
      currentRisk: calc.risk,
      remainingResources: session.remainingResources - costDelta,
    }

    const action = makeActionRecord(
      updatedSession,
      'adjust_ratio',
      fundId,
      delta,
      scoreBefore,
      riskBefore,
      resourcesBefore
    )

    set({
      session: updatedSession,
      actions: [...actions, action],
      toasts: pushToast(toasts, 'info', '调整配比', `${fund?.name ?? fundId} 配比调整 ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%`),
    })

    get().checkExceptions(action)
    get().checkForGameEnd()
  },

  pauseGame(reason: string) {
    const { session, actions, toasts } = get()
    if (!session || session.status !== 'playing') return

    const scoreBefore = session.currentScore
    const riskBefore = session.currentRisk
    const resourcesBefore = session.remainingResources

    const pauseRecord: PauseRecord = {
      id: `pause-${Date.now()}`,
      timestamp: Date.now(),
      reason,
      resumedAt: null,
      duration: null,
    }

    const updatedSession: GameSession = {
      ...session,
      status: 'paused',
      pauseRecords: [...session.pauseRecords, pauseRecord],
    }

    const action = makeActionRecord(
      updatedSession,
      'pause',
      null,
      0,
      scoreBefore,
      riskBefore,
      resourcesBefore
    )

    set({
      session: updatedSession,
      actions: [...actions, action],
      toasts: pushToast(toasts, 'warning', '游戏暂停', reason),
    })
  },

  resumeGame() {
    const { session, actions, toasts } = get()
    if (!session || session.status !== 'paused') return

    const scoreBefore = session.currentScore
    const riskBefore = session.currentRisk
    const resourcesBefore = session.remainingResources

    const now = Date.now()
    const updatedPauseRecords = session.pauseRecords.map(pr => {
      if (pr.resumedAt === null) {
        return {
          ...pr,
          resumedAt: now,
          duration: now - pr.timestamp,
        }
      }
      return pr
    })

    const updatedSession: GameSession = {
      ...session,
      status: 'playing',
      pauseRecords: updatedPauseRecords,
    }

    const action = makeActionRecord(
      updatedSession,
      'resume',
      null,
      0,
      scoreBefore,
      riskBefore,
      resourcesBefore
    )

    set({
      session: updatedSession,
      actions: [...actions, action],
      toasts: pushToast(toasts, 'info', '游戏继续', '已恢复游戏'),
    })
  },

  tick() {
    const { session } = get()
    if (!session || session.status !== 'playing') return

    const newTime = session.remainingTime - 1
    if (newTime <= 0) {
      set({
        session: {
          ...session,
          remainingTime: 0,
          status: 'failed',
          failReason: 'timeout',
          failDetail: '时间耗尽',
          completedAt: Date.now(),
        },
        toasts: pushToast(get().toasts, 'error', '游戏失败', '时间耗尽'),
      })
      return
    }

    set({ session: { ...session, remainingTime: newTime } })
  },

  submitPortfolio() {
    const { session, toasts } = get()
    if (!session || session.status !== 'playing') return

    const level = LEVELS.find(l => l.id === session.levelId)
    if (!level) return

    const result = checkGameEnd(session, level)
    if (result.ended) {
      if (result.result === 'completed') {
        set({
          session: {
            ...session,
            status: 'completed',
            completedAt: Date.now(),
          },
          toasts: pushToast(toasts, 'success', '恭喜通关', `得分：${session.currentScore.toFixed(2)}`),
        })
      } else {
        set({
          session: {
            ...session,
            status: 'failed',
            failReason: (result.failReason as GameSession['failReason']) ?? null,
            failDetail: result.failDetail ?? '',
            completedAt: Date.now(),
          },
          toasts: pushToast(toasts, 'error', '提交失败', result.failDetail ?? '未满足通关条件'),
        })
      }
    } else {
      set({
        toasts: pushToast(toasts, 'warning', '无法提交', '尚未满足通关条件，请继续调整组合'),
      })
    }
  },

  checkExceptions(action?: ActionRecord) {
    const { session, exceptions } = get()
    if (!session) return

    const level = LEVELS.find(l => l.id === session.levelId)
    if (!level) return

    const newExceptions: ExceptionRecord[] = []

    if (action) {
      const misop = detectMisoperation(action, session, level)
      if (misop) newExceptions.push(misop)
    }

    const boundary = detectBoundaryScore(session, level)
    if (boundary) newExceptions.push(boundary)

    const dirty = detectDirtyData({
      score: session.currentScore,
      risk: session.currentRisk,
      holdings: session.holdings,
    })
    if (dirty) newExceptions.push(dirty)

    if (newExceptions.length > 0) {
      set({ exceptions: [...exceptions, ...newExceptions] })
    }
  },

  checkForGameEnd() {
    const { session, toasts } = get()
    if (!session || session.status !== 'playing') return

    const level = LEVELS.find(l => l.id === session.levelId)
    if (!level) return

    const result = checkGameEnd(session, level)
    if (result.ended) {
      if (result.result === 'completed') {
        set({
          session: {
            ...session,
            status: 'completed',
            completedAt: Date.now(),
          },
          toasts: pushToast(toasts, 'success', '自动通关', '满足通关条件，游戏自动完成'),
        })
      } else {
        set({
          session: {
            ...session,
            status: 'failed',
            failReason: (result.failReason as GameSession['failReason']) ?? null,
            failDetail: result.failDetail ?? '',
            completedAt: Date.now(),
          },
          toasts: pushToast(toasts, 'error', '游戏失败', result.failDetail ?? '违反规则'),
        })
      }
    }
  },

  dismissToast(id: string) {
    set({ toasts: get().toasts.filter(t => t.id !== id) })
  },

  resetGame() {
    set({
      session: null,
      toasts: [],
      actions: [],
      exceptions: [],
      timerInterval: null,
    })
  },
}))
