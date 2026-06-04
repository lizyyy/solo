import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SafetyZoneStats } from '@/types'
import { getSafetyZoneStats } from '@/lib/api'

interface User {
  name: string
  role: 'teacher' | 'engineer' | 'admin'
}

interface AppState {
  currentUser: User
  pendingReviewCount: number
  safetyZoneStats: SafetyZoneStats | null
  isLoading: boolean
  error: string | null
  fetchStats: () => Promise<void>
  setPendingReviewCount: (count: number) => void
  setCurrentUser: (user: User) => void
  clearError: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: {
        name: '林老师',
        role: 'teacher',
      },
      pendingReviewCount: 0,
      safetyZoneStats: null,
      isLoading: false,
      error: null,

      fetchStats: async () => {
        set({ isLoading: true, error: null })
        try {
          const stats = await getSafetyZoneStats()
          set({
            safetyZoneStats: stats,
            pendingReviewCount: stats.pendingReview,
            isLoading: false,
          })
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : '获取统计数据失败',
            isLoading: false,
          })
        }
      },

      setPendingReviewCount: (count) => {
        set({ pendingReviewCount: count })
      },

      setCurrentUser: (user) => {
        set({ currentUser: user })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
      }),
    }
  )
)
