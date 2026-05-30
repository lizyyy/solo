import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Order, Location, Route, PathException, RouteStatus } from '@/types'
import { seedOrders, seedLocations, seedPickers } from './seedData'

interface WarehouseActions {
  addOrder: (order: Order) => void
  updateOrder: (id: string, updates: Partial<Order>) => void
  removeOrder: (id: string) => void

  addLocation: (location: Location) => void
  updateLocation: (id: string, updates: Partial<Location>) => void
  removeLocation: (id: string) => void
  checkDuplicateLocations: () => void

  addRoute: (route: Route) => void
  updateRoute: (id: string, updates: Partial<Route>) => void
  removeRoute: (id: string) => void
  updateRouteStatus: (id: string, status: RouteStatus) => void

  addException: (exception: PathException) => void
  updateException: (id: string, updates: Partial<PathException>) => void
  removeException: (id: string) => void
  clearExceptions: (routeId: string) => void

  addPicker: (name: string) => void

  resetToSeed: () => void
}

interface WarehouseStore extends WarehouseActions {
  orders: Order[]
  locations: Location[]
  routes: Route[]
  exceptions: PathException[]
  pickers: string[]
}

export const useWarehouseStore = create<WarehouseStore>()(
  persist(
    (set) => ({
      orders: seedOrders,
      locations: seedLocations,
      routes: [],
      exceptions: [],
      pickers: seedPickers,

      addOrder: (order) =>
        set((state) => ({ orders: [...state.orders, order] })),

      updateOrder: (id, updates) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, ...updates } : o
          ),
        })),

      removeOrder: (id) =>
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== id),
        })),

      addLocation: (location) =>
        set((state) => ({ locations: [...state.locations, location] })),

      updateLocation: (id, updates) =>
        set((state) => ({
          locations: state.locations.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          ),
        })),

      removeLocation: (id) =>
        set((state) => ({
          locations: state.locations.filter((l) => l.id !== id),
        })),

      checkDuplicateLocations: () =>
        set((state) => {
          const coordMap = new Map<string, string[]>()
          for (const loc of state.locations) {
            const key = `${loc.x},${loc.y}`
            const existing = coordMap.get(key) ?? []
            existing.push(loc.id)
            coordMap.set(key, existing)
          }
          const duplicateIds = new Set<string>()
          for (const ids of coordMap.values()) {
            if (ids.length > 1) {
              ids.forEach((id) => duplicateIds.add(id))
            }
          }
          return {
            locations: state.locations.map((l) => ({
              ...l,
              isDuplicate: duplicateIds.has(l.id),
            })),
          }
        }),

      addRoute: (route) =>
        set((state) => ({ routes: [...state.routes, route] })),

      updateRoute: (id, updates) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      removeRoute: (id) =>
        set((state) => ({
          routes: state.routes.filter((r) => r.id !== id),
        })),

      updateRouteStatus: (id, status) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === id ? { ...r, status } : r
          ),
        })),

      addException: (exception) =>
        set((state) => ({
          exceptions: [...state.exceptions, exception],
        })),

      updateException: (id, updates) =>
        set((state) => ({
          exceptions: state.exceptions.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),

      removeException: (id) =>
        set((state) => ({
          exceptions: state.exceptions.filter((e) => e.id !== id),
        })),

      clearExceptions: (routeId) =>
        set((state) => ({
          exceptions: state.exceptions.filter((e) => e.routeId !== routeId),
        })),

      addPicker: (name) =>
        set((state) => ({
          pickers: [...state.pickers, name],
        })),

      resetToSeed: () =>
        set({
          orders: seedOrders,
          locations: seedLocations,
          routes: [],
          exceptions: [],
          pickers: seedPickers,
        }),
    }),
    {
      name: 'warehouse-picking-store',
    }
  )
)
