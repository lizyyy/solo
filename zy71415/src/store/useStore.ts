import { create } from "zustand"
import type { SubAccount, FilterState, CollectStatus, SortField, SortDirection } from "@/types"
import { MOCK_SUB_ACCOUNTS, RULE_VERSIONS, BANKS, generateAlerts } from "@/data/mockData"

interface CashManagementStore {
  accounts: SubAccount[]
  filter: FilterState
  sortField: SortField
  sortDirection: SortDirection
  selectedIds: Set<string>
  traceDrawerOpen: boolean
  traceDrawerAccountId: string | null
  currentRuleVersion: string

  setFilter: (partial: Partial<FilterState>) => void
  resetFilter: () => void
  setSort: (field: SortField) => void
  toggleSelect: (id: string) => void
  toggleSelectAll: (ids: string[]) => void
  clearSelection: () => void
  openTraceDrawer: (accountId: string) => void
  closeTraceDrawer: () => void
  confirmRecords: (ids: string[]) => void
  returnRecords: (ids: string[]) => void
  getFilteredAccounts: () => SubAccount[]
  getKpiData: () => {
    totalCollect: number
    reserveShortageCount: number
    limitExceededCount: number
    pendingCount: number
    returnedCount: number
  }
  getAlerts: () => ReturnType<typeof generateAlerts>
  getRuleVersions: () => typeof RULE_VERSIONS
  getCurrentRule: () => typeof RULE_VERSIONS[number]
  importAccounts: (newAccounts: SubAccount[], version: string) => { success: boolean; message: string }
  exportAccounts: () => string
}

const defaultFilter: FilterState = {
  dateRange: ["2026-05-22", "2026-05-28"],
  banks: [],
  statuses: [],
  ruleVersion: "",
  searchKeyword: "",
}

export const useStore = create<CashManagementStore>((set, get) => ({
  accounts: MOCK_SUB_ACCOUNTS,
  filter: { ...defaultFilter },
  sortField: "collectDate",
  sortDirection: "desc",
  selectedIds: new Set<string>(),
  traceDrawerOpen: false,
  traceDrawerAccountId: null,
  currentRuleVersion: "v3.2",

  setFilter: (partial) =>
    set((state) => ({
      filter: { ...state.filter, ...partial },
      selectedIds: new Set(),
    })),

  resetFilter: () => set({ filter: { ...defaultFilter }, selectedIds: new Set() }),

  setSort: (field) =>
    set((state) => {
      if (state.sortField === field) {
        return { sortDirection: state.sortDirection === "asc" ? "desc" : "asc" }
      }
      return { sortField: field, sortDirection: "desc" }
    }),

  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    }),

  toggleSelectAll: (ids) =>
    set((state) => {
      const allSelected = ids.every((id) => state.selectedIds.has(id))
      const next = new Set(state.selectedIds)
      if (allSelected) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return { selectedIds: next }
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  openTraceDrawer: (accountId) => set({ traceDrawerOpen: true, traceDrawerAccountId: accountId }),
  closeTraceDrawer: () => set({ traceDrawerOpen: false, traceDrawerAccountId: null }),

  confirmRecords: (ids) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        ids.includes(acc.id) ? { ...acc, status: "processed" as CollectStatus } : acc
      ),
      selectedIds: new Set(),
    })),

  returnRecords: (ids) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        ids.includes(acc.id)
          ? {
              ...acc,
              status: "returned" as CollectStatus,
              sourceTrace: [
                ...acc.sourceTrace,
                {
                  step: acc.sourceTrace.length + 1,
                  action: "退回补材料",
                  timestamp: new Date().toISOString(),
                  operator: "当前操作员",
                  ruleVersion: acc.ruleVersion,
                  detail: "退回：要求补充材料后重新提交",
                },
              ],
            }
          : acc
      ),
      selectedIds: new Set(),
    })),

  getFilteredAccounts: () => {
    const { accounts, filter, sortField, sortDirection } = get()
    let filtered = accounts.filter((acc) => {
      if (filter.dateRange[0] && acc.collectDate < filter.dateRange[0]) return false
      if (filter.dateRange[1] && acc.collectDate > filter.dateRange[1]) return false
      if (filter.banks.length > 0 && !filter.banks.includes(acc.bank)) return false
      if (filter.statuses.length > 0 && !filter.statuses.includes(acc.status)) return false
      if (filter.ruleVersion && acc.ruleVersion !== filter.ruleVersion) return false
      if (filter.searchKeyword) {
        const kw = filter.searchKeyword.toLowerCase()
        if (
          !acc.accountName.toLowerCase().includes(kw) &&
          !acc.accountNo.toLowerCase().includes(kw)
        )
          return false
      }
      return true
    })
    filtered = filtered.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const dir = sortDirection === "asc" ? 1 : -1
      if (typeof aVal === "string" && typeof bVal === "string") {
        return dir * aVal.localeCompare(bVal)
      }
      return dir * ((aVal as number) - (bVal as number))
    })
    return filtered
  },

  getKpiData: () => {
    const filtered = get().getFilteredAccounts()
    return {
      totalCollect: filtered.reduce((sum, acc) => sum + acc.collectAmount, 0),
      reserveShortageCount: filtered.filter((acc) => acc.isReserveShortage).length,
      limitExceededCount: filtered.filter((acc) => acc.isLimitExceeded).length,
      pendingCount: filtered.filter((acc) => acc.status === "pending").length,
      returnedCount: filtered.filter((acc) => acc.status === "returned").length,
    }
  },

  getAlerts: () => {
    const filtered = get().getFilteredAccounts()
    return generateAlerts(filtered)
  },

  getRuleVersions: () => RULE_VERSIONS,
  getCurrentRule: () => RULE_VERSIONS.find((r) => r.version === get().currentRuleVersion) || RULE_VERSIONS[0],

  importAccounts: (newAccounts, version) => {
    const currentVersion = get().currentRuleVersion
    if (version !== currentVersion) {
      return {
        success: false,
        message: `规则版本不一致：导入数据版本为${version}，当前生效版本为${currentVersion}，请确认后重试`,
      }
    }
    set((state) => ({
      accounts: [...state.accounts, ...newAccounts],
    }))
    return { success: true, message: `成功导入${newAccounts.length}条记录` }
  },

  exportAccounts: () => {
    const filtered = get().getFilteredAccounts()
    const currentVersion = get().currentRuleVersion
    const exportData = filtered.map((acc) => ({
      ...acc,
      _exportRuleVersion: currentVersion,
      _exportTimestamp: new Date().toISOString(),
      _statusCaliber: `${currentVersion}口径`,
    }))
    return JSON.stringify(exportData, null, 2)
  },
}))
