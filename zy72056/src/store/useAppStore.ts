import { create } from "zustand"
import type { StationPoint, AuditLog, FilterState, QualityStatus, AuditAction, DeviceType, SupplementRecord } from "@/data/types"
import { mockStationPoints } from "@/data/mockStation"
import { mockTimeSlots } from "@/data/mockTimeSlots"

interface AppState {
  points: StationPoint[]
  timeSlots: typeof mockTimeSlots
  filter: FilterState
  selectedPointId: string | null
  auditLogs: AuditLog[]
  auditPanelOpen: boolean
  filterPanelOpen: boolean
  detailPanelOpen: boolean
  previousPointSnapshot: Map<string, StationPoint>

  setFilter: (filter: Partial<FilterState>) => void
  selectPoint: (id: string | null) => void
  addAuditLog: (action: AuditAction, details: string, targetId?: string, snapshot?: Record<string, unknown>) => void
  resolveQualityFlag: (pointId: string, flagIndex: number, note: string) => void
  supplementPoint: (pointId: string, field: string, oldValue: string, newValue: string) => void
  correctPointCoordinate: (pointId: string, newX: number, newY: number) => void
  toggleAuditPanel: () => void
  toggleFilterPanel: () => void
  toggleDetailPanel: () => void
  getFilteredPoints: () => StationPoint[]
  getPointQualityStatus: (point: StationPoint) => QualityStatus
  getCongestionForHour: (pointId: string, hour: number) => number
}

export const useAppStore = create<AppState>((set, get) => ({
  points: JSON.parse(JSON.stringify(mockStationPoints)),
  timeSlots: mockTimeSlots,
  filter: {
    floors: ["B1", "B2"],
    types: ["entrance", "exit", "escalator", "elevator", "gate", "corridor", "camera"],
    qualityStatus: ["ok", "warning", "error"],
    timeHour: 8,
  },
  selectedPointId: null,
  auditLogs: [],
  auditPanelOpen: false,
  filterPanelOpen: true,
  detailPanelOpen: true,
  previousPointSnapshot: new Map(),

  setFilter: (partial) => {
    const newFilter = { ...get().filter, ...partial }
    set({ filter: newFilter })
    get().addAuditLog("filter", `筛选条件变更: ${JSON.stringify(partial)}`)
  },

  selectPoint: (id) => {
    set({ selectedPointId: id, detailPanelOpen: true })
    if (id) {
      get().addAuditLog("select", `选中点位: ${id}`, id)
    }
  },

  addAuditLog: (action, details, targetId, snapshot) => {
    const log: AuditLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      targetId,
      details,
      snapshot,
    }
    set(state => ({ auditLogs: [...state.auditLogs, log] }))
  },

  resolveQualityFlag: (pointId, flagIndex, note) => {
    set(state => {
      const points = state.points.map(p => {
        if (p.id !== pointId) return p
        const flags = [...p.qualityFlags]
        if (flags[flagIndex]) {
          flags[flagIndex] = { ...flags[flagIndex], resolved: true, resolvedNote: note }
        }
        return { ...p, qualityFlags: flags, lastModified: new Date().toISOString() }
      })
      return { points }
    })
    get().addAuditLog("annotate", `标记质量问题已处理: ${pointId} flag[${flagIndex}] - ${note}`, pointId)
  },

  supplementPoint: (pointId, field, oldValue, newValue) => {
    const supplement: SupplementRecord = {
      id: `SUP-${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: `补录 ${field}`,
      field,
      oldValue,
      newValue,
    }
    set(state => {
      const prev = new Map(state.previousPointSnapshot)
      const point = state.points.find(p => p.id === pointId)
      if (point) prev.set(pointId, { ...point })

      const points = state.points.map(p => {
        if (p.id !== pointId) return p
        return {
          ...p,
          supplements: [...p.supplements, supplement],
          lastModified: new Date().toISOString(),
          [field]: newValue,
        }
      })
      return { points, previousPointSnapshot: prev }
    })
    get().addAuditLog("supplement", `补录 ${field}: "${oldValue}" → "${newValue}"`, pointId, {
      pointId, field, oldValue, newValue,
    })
  },

  correctPointCoordinate: (pointId, newX, newY) => {
    set(state => {
      const prev = new Map(state.previousPointSnapshot)
      const point = state.points.find(p => p.id === pointId)
      if (point) prev.set(pointId, { ...point })

      const points = state.points.map(p => {
        if (p.id !== pointId) return p
        return { ...p, x: newX, y: newY, lastModified: new Date().toISOString() }
      })
      return { points, previousPointSnapshot: prev }
    })
    get().addAuditLog("correct", `修正坐标: ${pointId} → (${newX.toFixed(1)}, ${newY.toFixed(1)})`, pointId)
  },

  toggleAuditPanel: () => set(state => ({ auditPanelOpen: !state.auditPanelOpen })),
  toggleFilterPanel: () => set(state => ({ filterPanelOpen: !state.filterPanelOpen })),
  toggleDetailPanel: () => set(state => ({ detailPanelOpen: !state.detailPanelOpen })),

  getFilteredPoints: () => {
    const { points, filter } = get()
    return points.filter(p => {
      if (!filter.floors.includes(p.floor)) return false
      if (!filter.types.includes(p.type)) return false
      const status = get().getPointQualityStatus(p)
      if (!filter.qualityStatus.includes(status)) return false
      return true
    })
  },

  getPointQualityStatus: (point) => {
    const unresolved = point.qualityFlags.filter(f => !f.resolved)
    if (unresolved.some(f => f.type === "cross_floor")) return "error"
    if (unresolved.length > 0) return "warning"
    return "ok"
  },

  getCongestionForHour: (pointId, hour) => {
    const slot = get().timeSlots.find(t => t.hour === hour)
    if (!slot) return 0
    const entry = slot.points.find(p => p.id === pointId)
    return entry?.congestion ?? 0
  },
}))
