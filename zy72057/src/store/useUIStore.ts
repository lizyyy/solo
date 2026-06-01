import { create } from "zustand"
import type { ItemStatus } from "@/types"

interface UIStore {
  reportOpen: boolean
  filterStatus: ItemStatus | "all"
  filterType: "all" | "building" | "panel" | "inverter"
  searchText: string
  activeTab: "scene" | "table"
  selectedItemId: string | null
  importModalOpen: boolean
  schemeModalOpen: boolean

  toggleReport: () => void
  setFilterStatus: (s: ItemStatus | "all") => void
  setFilterType: (t: "all" | "building" | "panel" | "inverter") => void
  setSearchText: (t: string) => void
  setActiveTab: (t: "scene" | "table") => void
  selectItem: (id: string | null) => void
  setImportModalOpen: (open: boolean) => void
  setSchemeModalOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  reportOpen: false,
  filterStatus: "all",
  filterType: "all",
  searchText: "",
  activeTab: "scene",
  selectedItemId: null,
  importModalOpen: false,
  schemeModalOpen: false,

  toggleReport: () => set((s) => ({ reportOpen: !s.reportOpen })),
  setFilterStatus: (s) => set({ filterStatus: s }),
  setFilterType: (t) => set({ filterType: t }),
  setSearchText: (t) => set({ searchText: t }),
  setActiveTab: (t) => set({ activeTab: t }),
  selectItem: (id) => set({ selectedItemId: id }),
  setImportModalOpen: (open) => set({ importModalOpen: open }),
  setSchemeModalOpen: (open) => set({ schemeModalOpen: open }),
}))
