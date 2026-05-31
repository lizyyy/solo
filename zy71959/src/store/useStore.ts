import { create } from "zustand"
import type { PVRoute, InspectionPhoto, AnomalyRecord, KMLTrack, ImportMode, ImportHistory, RouteStatus, AnomalyType, AnomalyStatus } from "@/types"
import { mockRoutes, mockPhotos, mockAnomalies, mockKMLTracks } from "@/data/mockData"

interface FilterState {
  statusFilter: RouteStatus[]
  anomalyTypeFilter: AnomalyType[]
  dateRange: { start: string; end: string }
  searchQuery: string
}

interface StoreState {
  routes: PVRoute[]
  photos: InspectionPhoto[]
  anomalies: AnomalyRecord[]
  kmlTracks: KMLTrack[]
  importHistory: ImportHistory[]
  filters: FilterState
  selectedRouteId: string | null
  lightboxPhotoId: string | null

  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  selectRoute: (id: string | null) => void
  openLightbox: (photoId: string | null) => void

  importRoutes: (routes: PVRoute[], mode: ImportMode) => void
  undoLastImport: () => void
  reviewAnomaly: (anomalyId: string, status: AnomalyStatus, reason: string, reviewer: string) => void
  exportCSV: () => string

  getRouteById: (id: string) => PVRoute | undefined
  getPhotosByRouteId: (routeId: string) => InspectionPhoto[]
  getAnomaliesByRouteId: (routeId: string) => AnomalyRecord[]
  getKMLByRouteId: (routeId: string) => KMLTrack | undefined
  getFilteredRoutes: () => PVRoute[]
  getStats: () => { total: number; normal: number; pending: number; abnormal: number }
}

const defaultFilters: FilterState = {
  statusFilter: [],
  anomalyTypeFilter: [],
  dateRange: { start: "", end: "" },
  searchQuery: "",
}

function detectAnomalies(route: PVRoute): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = []
  if (Math.abs(route.batteryCycles - route.expectedCycles) > 2) {
    anomalies.push({
      id: `auto-${route.id}-battery`,
      routeId: route.id,
      type: "battery_cycle_error",
      status: "pending",
      description: `电池循环数(${route.batteryCycles})与累计充电次数(${route.expectedCycles})偏差为${Math.abs(route.batteryCycles - route.expectedCycles)}，超过阈值2`,
      detectionReason: `电池循环数与预期偏差 = |${route.batteryCycles} - ${route.expectedCycles}| = ${Math.abs(route.batteryCycles - route.expectedCycles)} > 2，触发自动检测规则`,
      reviewReason: "",
      reviewer: "",
      reviewDate: "",
      sourceLinks: [],
    })
  }
  if (route.returnPointStatus !== "ok") {
    const label = route.returnPointStatus === "lost" ? "未检测到返航坐标点" : "返航高度低于安全阈值"
    anomalies.push({
      id: `auto-${route.id}-rth`,
      routeId: route.id,
      type: "return_point_lost",
      status: "pending",
      description: label,
      detectionReason: `返航点状态为 ${route.returnPointStatus}，${label}`,
      reviewReason: "",
      reviewer: "",
      reviewDate: "",
      sourceLinks: [],
    })
  }
  if (route.noFlyZoneDistance < 50) {
    anomalies.push({
      id: `auto-${route.id}-nfz`,
      routeId: route.id,
      type: "no_fly_zone_edge",
      status: "pending",
      description: `航线最近点距禁飞区边界仅${route.noFlyZoneDistance}m，低于50m安全距离`,
      detectionReason: `禁飞区距离 = ${route.noFlyZoneDistance}m < 50m，触发自动检测规则`,
      reviewReason: "",
      reviewer: "",
      reviewDate: "",
      sourceLinks: [],
    })
  }
  return anomalies
}

function computeRouteStatus(anomalies: AnomalyRecord[]): RouteStatus {
  if (anomalies.length === 0) return "normal"
  if (anomalies.some((a) => a.status === "pending")) return "pending"
  return "abnormal"
}

export const useStore = create<StoreState>((set, get) => ({
  routes: mockRoutes,
  photos: mockPhotos,
  anomalies: mockAnomalies,
  kmlTracks: mockKMLTracks,
  importHistory: [],
  filters: { ...defaultFilters },
  selectedRouteId: null,
  lightboxPhotoId: null,

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),

  selectRoute: (id) => set({ selectedRouteId: id }),

  openLightbox: (photoId) => set({ lightboxPhotoId: photoId }),

  importRoutes: (newRoutes, mode) => {
    const snapshot = get().routes.map((r) => ({ ...r }))
    set((state) => {
      let updatedRoutes: PVRoute[]
      if (mode === "overwrite") {
        const existingIds = new Set(newRoutes.map((r) => r.id))
        updatedRoutes = [
          ...newRoutes,
          ...state.routes.filter((r) => !existingIds.has(r.id)),
        ]
      } else {
        updatedRoutes = [...state.routes, ...newRoutes]
      }

      const newAnomalies: AnomalyRecord[] = []
      updatedRoutes.forEach((route) => {
        const existing = state.anomalies.filter((a) => a.routeId === route.id)
        if (existing.length === 0) {
          newAnomalies.push(...detectAnomalies(route))
        }
      })

      const allAnomalies = [...state.anomalies, ...newAnomalies]
      updatedRoutes = updatedRoutes.map((route) => {
        const routeAnomalies = allAnomalies.filter((a) => a.routeId === route.id)
        const status = computeRouteStatus(routeAnomalies)
        return { ...route, status }
      })

      const importEntry: ImportHistory = {
        id: `imp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode,
        routeIds: newRoutes.map((r) => r.id),
        routeCount: newRoutes.length,
      }

      return {
        routes: updatedRoutes,
        anomalies: allAnomalies,
        importHistory: [...state.importHistory, importEntry],
      }
    })

    const state = get()
    set((s) => ({
      routes: s.routes,
      _snapshot: snapshot,
    }))
  },

  undoLastImport: () => {
    set((state) => {
      const history = [...state.importHistory]
      if (history.length === 0) return state
      const lastImport = history.pop()!
      const removedIds = new Set(lastImport.routeIds)
      const routes = state.routes.filter((r) => !removedIds.has(r.id))
      const anomalies = state.anomalies.filter((a) => !removedIds.has(a.routeId))
      return { routes, anomalies, importHistory: history }
    })
  },

  reviewAnomaly: (anomalyId, status, reason, reviewer) => {
    set((state) => {
      const anomalies = state.anomalies.map((a) =>
        a.id === anomalyId
          ? { ...a, status, reviewReason: reason, reviewer, reviewDate: new Date().toISOString().split("T")[0] }
          : a
      )
      const affectedRouteId = state.anomalies.find((a) => a.id === anomalyId)?.routeId
      let routes = state.routes
      if (affectedRouteId) {
        routes = routes.map((route) => {
          if (route.id === affectedRouteId) {
            const routeAnomalies = anomalies.filter((a) => a.routeId === route.id)
            const newStatus = computeRouteStatus(routeAnomalies)
            return { ...route, status: newStatus }
          }
          return route
        })
      }
      return { anomalies, routes }
    })
  },

  exportCSV: () => {
    const { getFilteredRoutes, anomalies } = get()
    const filteredRoutes = getFilteredRoutes()
    const headers = ["航线ID", "航线名称", "日期", "状态", "电池循环", "预期循环", "飞行时长(min)", "返航点状态", "禁飞区距离(m)", "异常数"]
    const rows = filteredRoutes.map((r) => {
      const anomalyCount = anomalies.filter((a) => a.routeId === r.id).length
      return [r.id, r.name, r.date, r.status, r.batteryCycles, r.expectedCycles, r.flightDuration, r.returnPointStatus, r.noFlyZoneDistance, anomalyCount].join(",")
    })
    return [headers.join(","), ...rows].join("\n")
  },

  getRouteById: (id) => get().routes.find((r) => r.id === id),

  getPhotosByRouteId: (routeId) => get().photos.filter((p) => p.routeId === routeId),

  getAnomaliesByRouteId: (routeId) => get().anomalies.filter((a) => a.routeId === routeId),

  getKMLByRouteId: (routeId) => get().kmlTracks.find((k) => k.routeId === routeId),

  getFilteredRoutes: () => {
    const { routes, anomalies, filters } = get()
    return routes.filter((route) => {
      if (filters.statusFilter.length > 0 && !filters.statusFilter.includes(route.status)) return false
      if (filters.anomalyTypeFilter.length > 0) {
        const routeAnomalies = anomalies.filter((a) => a.routeId === route.id)
        if (!routeAnomalies.some((a) => filters.anomalyTypeFilter.includes(a.type))) return false
      }
      if (filters.dateRange.start && route.date < filters.dateRange.start) return false
      if (filters.dateRange.end && route.date > filters.dateRange.end) return false
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase()
        if (!route.name.toLowerCase().includes(q) && !route.id.toLowerCase().includes(q) && !route.pilot.toLowerCase().includes(q)) return false
      }
      return true
    })
  },

  getStats: () => {
    const routes = get().routes
    return {
      total: routes.length,
      normal: routes.filter((r) => r.status === "normal").length,
      pending: routes.filter((r) => r.status === "pending").length,
      abnormal: routes.filter((r) => r.status === "abnormal").length,
    }
  },
}))
