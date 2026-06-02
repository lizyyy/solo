import { create } from 'zustand'
import type { Feedback } from '@/types'
import { getDB, generateId, nowISO } from '@/services/db'

interface FeedbackState {
  feedbacks: Feedback[]
  loadAll: () => Promise<void>
  addFeedback: (feedback: Omit<Feedback, 'id' | 'createdAt'>) => Promise<void>
  updateFeedbackStatus: (id: string, status: Feedback['status']) => Promise<void>
  getByLocationId: (locationId: string) => Feedback[]
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  feedbacks: [],

  loadAll: async () => {
    const db = await getDB()
    const feedbacks = await db.getAll('feedbacks')
    set({ feedbacks })
  },

  addFeedback: async (feedback) => {
    const db = await getDB()
    const record: Feedback = { ...feedback, id: generateId(), createdAt: nowISO() }
    await db.put('feedbacks', record)
    set((state) => ({ feedbacks: [...state.feedbacks, record] }))
  },

  updateFeedbackStatus: async (id, status) => {
    const db = await getDB()
    const existing = await db.get('feedbacks', id)
    if (!existing) return
    const updated: Feedback = { ...existing, status }
    await db.put('feedbacks', updated)
    set((state) => ({
      feedbacks: state.feedbacks.map((f) => (f.id === id ? updated : f)),
    }))
  },

  getByLocationId: (locationId) => {
    return get().feedbacks.filter((f) => f.locationId === locationId)
  },
}))
