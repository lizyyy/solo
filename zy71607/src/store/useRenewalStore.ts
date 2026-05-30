import { create } from 'zustand'
import type { RenewalTask, CustomerNote, ExceptionType } from '@/types'
import { mockTasks } from '@/data/mock'

interface RenewalState {
  tasks: RenewalTask[]
  activeTaskId: string | null
  activeStep: number

  setActiveTaskId: (id: string | null) => void
  setActiveStep: (step: number) => void
  addNote: (taskId: string, content: string) => void
  skipException: (taskId: string, exceptionType: ExceptionType) => void
  resolveException: (taskId: string, exceptionType: ExceptionType) => void
  getTaskById: (id: string) => RenewalTask | undefined
  getStatusCounts: () => Record<RenewalTask['status'], number>
  getExceptionCounts: () => Record<ExceptionType, number>
  getMatchRateByChannel: () => { channel: string; matched: number; mismatched: number }[]
}

export const useRenewalStore = create<RenewalState>((set, get) => ({
  tasks: mockTasks,
  activeTaskId: null,
  activeStep: 0,

  setActiveTaskId: (id) => set({ activeTaskId: id, activeStep: 0 }),
  setActiveStep: (step) => set({ activeStep: step }),

  addNote: (taskId, content) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              notes: [
                ...task.notes,
                {
                  id: `NT-${Date.now()}`,
                  policyId: task.policyId,
                  content,
                  timestamp: new Date().toLocaleString('zh-CN'),
                  author: '当前用户',
                },
              ],
            }
          : task
      ),
    })),

  skipException: (taskId, exceptionType) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              exceptionTypes: task.exceptionTypes.filter((t) => t !== exceptionType),
              status: task.exceptionTypes.filter((t) => t !== exceptionType).length === 0 ? 'processing' : 'exception',
            }
          : task
      ),
    })),

  resolveException: (taskId, exceptionType) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              exceptionTypes: task.exceptionTypes.filter((t) => t !== exceptionType),
              status: task.exceptionTypes.filter((t) => t !== exceptionType).length === 0 ? 'completed' : 'exception',
            }
          : task
      ),
    })),

  getTaskById: (id) => get().tasks.find((t) => t.id === id),

  getStatusCounts: () => {
    const counts: Record<RenewalTask['status'], number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      exception: 0,
    }
    get().tasks.forEach((t) => { counts[t.status]++ })
    return counts
  },

  getExceptionCounts: () => {
    const counts: Record<ExceptionType, number> = {
      claim_missing: 0,
      discount_error: 0,
      quote_overwrite: 0,
      channel_conflict: 0,
    }
    get().tasks.forEach((t) => t.exceptionTypes.forEach((e) => { counts[e]++ }))
    return counts
  },

  getMatchRateByChannel: () => {
    const channels = new Map<string, { matched: number; mismatched: number }>()
    get().tasks.forEach((task) => {
      task.quotes.forEach((q) => {
        if (!channels.has(q.channel)) {
          channels.set(q.channel, { matched: 0, mismatched: 0 })
        }
        const ch = channels.get(q.channel)!
        const expectedPremium = task.policy.premium * task.discount.finalCoefficient
        const diff = Math.abs(q.premium - expectedPremium) / expectedPremium
        if (diff < 0.05) {
          ch.matched++
        } else {
          ch.mismatched++
        }
      })
    })
    return Array.from(channels.entries()).map(([channel, data]) => ({
      channel,
      ...data,
    }))
  },
}))
