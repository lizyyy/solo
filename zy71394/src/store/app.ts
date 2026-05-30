import { create } from 'zustand'
import type { PromptFilter } from '../../shared/types'

interface AppState {
  currentUser: string
  filter: PromptFilter
  searchQuery: string
  duplicateCheckResult: { visible: boolean; title: string; content: string } | null
  selectedPromptId: string | null
  setCurrentUser: (user: string) => void
  setFilter: (filter: Partial<PromptFilter>) => void
  resetFilter: () => void
  setSearchQuery: (q: string) => void
  showDuplicateCheck: (title: string, content: string) => void
  hideDuplicateCheck: () => void
  setSelectedPromptId: (id: string | null) => void
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: localStorage.getItem('currentUser') || '开发者',
  filter: {
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  searchQuery: '',
  duplicateCheckResult: null,
  selectedPromptId: null,

  setCurrentUser: (user) => {
    localStorage.setItem('currentUser', user)
    set({ currentUser: user })
  },

  setFilter: (newFilter) => {
    set({ filter: { ...get().filter, ...newFilter } })
  },

  resetFilter: () => {
    set({
      filter: {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    })
  },

  setSearchQuery: (q) => {
    set({ searchQuery: q })
  },

  showDuplicateCheck: (title, content) => {
    set({ duplicateCheckResult: { visible: true, title, content } })
  },

  hideDuplicateCheck: () => {
    set({ duplicateCheckResult: null })
  },

  setSelectedPromptId: (id) => {
    set({ selectedPromptId: id })
  },
}))
