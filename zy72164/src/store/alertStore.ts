import { create } from "zustand"
import type { AlertPoint, AlertStatus, AlertFilter, ProcessAction } from "@/types/alert"
import { mockAlerts } from "@/data/mockAlerts"

interface AlertStore {
  alerts: AlertPoint[]
  filter: AlertFilter
  selectedAlertId: string | null

  setFilter: (filter: AlertFilter) => void
  selectAlert: (id: string | null) => void
  addProcessRecord: (alertId: string, action: ProcessAction, opinion: string) => void
  getFilteredAlerts: () => AlertPoint[]
  getAlertById: (id: string) => AlertPoint | undefined
  getStats: () => { total: number; processed: number; pending: number; recheck: number }
  exportCSV: (status: AlertStatus) => string
}

const STORAGE_KEY = "night-economy-alerts"

function loadAlerts(): AlertPoint[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return mockAlerts
}

function saveAlerts(alerts: AlertPoint[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: loadAlerts(),
  filter: { status: "all", sourceType: "all", dateRange: null },
  selectedAlertId: null,

  setFilter: (filter) => set({ filter }),

  selectAlert: (id) => set({ selectedAlertId: id }),

  addProcessRecord: (alertId, action, opinion) => {
    set((state) => {
      const alerts = state.alerts.map((a) => {
        if (a.id !== alertId) return a
        const newRecord = {
          id: `pr-${Date.now()}`,
          action,
          operator: "小赵",
          opinion,
          processedAt: new Date().toISOString(),
          isOverridden: false,
        }
        let newStatus: AlertStatus = a.status
        if (action === "confirmed") newStatus = "processed"
        else if (action === "marked_pending") newStatus = "pending"
        else if (action === "marked_recheck") newStatus = "recheck"
        return {
          ...a,
          status: newStatus,
          processRecords: [...a.processRecords, newRecord],
          updatedAt: newRecord.processedAt,
        }
      })
      saveAlerts(alerts)
      return { alerts }
    })
  },

  getFilteredAlerts: () => {
    const { alerts, filter } = get()
    return alerts.filter((a) => {
      if (filter.status !== "all" && a.status !== filter.status) return false
      if (filter.sourceType !== "all" && a.sourceType !== filter.sourceType) return false
      if (filter.dateRange) {
        const d = new Date(a.createdAt).getTime()
        const start = new Date(filter.dateRange.start).getTime()
        const end = new Date(filter.dateRange.end).getTime()
        if (d < start || d > end) return false
      }
      return true
    })
  },

  getAlertById: (id) => get().alerts.find((a) => a.id === id),

  getStats: () => {
    const { alerts } = get()
    return {
      total: alerts.length,
      processed: alerts.filter((a) => a.status === "processed").length,
      pending: alerts.filter((a) => a.status === "pending").length,
      recheck: alerts.filter((a) => a.status === "recheck").length,
    }
  },

  exportCSV: (status) => {
    const { alerts } = get()
    const filtered = alerts.filter((a) => a.status === status)
    const statusLabel = { processed: "已处理", pending: "待核实", recheck: "需现场复看" }[status]
    const sourceLabel = {
      inspection_report: "巡检报告",
      inspection_photo: "巡检照片",
      complaint: "市民投诉",
      statistics: "统计数据",
    }

    const header = "预警编号,名称,状态,来源类型,原始来源编号,首次记录时间,最近更新时间,坐标,是否旧口径\n"
    const rows = filtered
      .map(
        (a) =>
          `${a.id},${a.name},${statusLabel},${sourceLabel[a.sourceType]},${a.sources[0]?.referenceNo || ""},${a.createdAt},${a.updatedAt},"${a.lat},${a.lng}",${a.isOldCaliber ? "是" : "否"}`
      )
      .join("\n")

    return header + rows
  },
}))
