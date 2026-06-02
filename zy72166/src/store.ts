import { create } from 'zustand'

interface ProjectStore {
  currentProjectId: string | null
  setCurrentProjectId: (id: string | null) => void
  operator: string
  setOperator: (name: string) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  operator: '',
  setOperator: (name) => set({ operator: name }),
}))
