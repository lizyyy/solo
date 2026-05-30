import { create } from "zustand"
import type {
  StageScene,
  Collision,
  AuditLog,
  SelectedElement,
  Vector3,
  Fixture,
  LightBar,
  HangingPoint,
  ActorRoute,
} from "@/types"
import { sampleScene } from "@/utils/sampleData"
import { runAllDetections } from "@/utils/collisionEngine"

interface StageStore {
  scene: StageScene
  selectedElement: SelectedElement | null
  hoveredCollision: string | null
  panelTab: "properties" | "collisions" | "audit"
  sidebarOpen: boolean

  setSelectedElement: (el: SelectedElement | null) => void
  setHoveredCollision: (id: string | null) => void
  setPanelTab: (tab: "properties" | "collisions" | "audit") => void
  setSidebarOpen: (open: boolean) => void

  updateFixturePosition: (id: string, position: Vector3) => void
  updateFixtureTarget: (id: string, target: Vector3) => void
  updateLightBarPosition: (id: string, position: Vector3) => void
  updateHangingPointLoadCapacity: (id: string, capacity: number, reason: string) => void
  updateHangingPointPosition: (id: string, position: Vector3) => void
  updateActorRouteWaypoints: (id: string, waypoints: Vector3[], reason: string) => void

  resolveCollision: (id: string, resolution: string) => void
  runCollisionDetection: () => void

  addAuditLog: (log: Omit<AuditLog, "id" | "timestamp">) => void
  loadScene: (scene: StageScene) => void
}

export const useStore = create<StageStore>((set, get) => ({
  scene: {
    ...sampleScene,
    collisions: runAllDetections(
      sampleScene.lightBars,
      sampleScene.hangingPoints,
      sampleScene.fixtures,
      sampleScene.actorRoutes,
    ),
  },
  selectedElement: null,
  hoveredCollision: null,
  panelTab: "collisions",
  sidebarOpen: true,

  setSelectedElement: (el) => set({ selectedElement: el }),
  setHoveredCollision: (id) => set({ hoveredCollision: id }),
  setPanelTab: (tab) => set({ panelTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  updateFixturePosition: (id, position) => {
    const { scene } = get()
    const oldFixture = scene.fixtures.find((f) => f.id === id)
    if (!oldFixture) return

    const newFixtures = scene.fixtures.map((f) =>
      f.id === id ? { ...f, position } : f,
    )
    const newCollisions = runAllDetections(
      scene.lightBars,
      scene.hangingPoints,
      newFixtures,
      scene.actorRoutes,
    )
    set({
      scene: { ...scene, fixtures: newFixtures, collisions: newCollisions },
    })
  },

  updateFixtureTarget: (id, targetPosition) => {
    const { scene } = get()
    const newFixtures = scene.fixtures.map((f) =>
      f.id === id ? { ...f, targetPosition } : f,
    )
    const newCollisions = runAllDetections(
      scene.lightBars,
      scene.hangingPoints,
      newFixtures,
      scene.actorRoutes,
    )
    set({
      scene: { ...scene, fixtures: newFixtures, collisions: newCollisions },
    })
  },

  updateLightBarPosition: (id, position) => {
    const { scene } = get()
    const newLightBars = scene.lightBars.map((lb) =>
      lb.id === id ? { ...lb, position } : lb,
    )
    const newCollisions = runAllDetections(
      newLightBars,
      scene.hangingPoints,
      scene.fixtures,
      scene.actorRoutes,
    )
    set({
      scene: { ...scene, lightBars: newLightBars, collisions: newCollisions },
    })
  },

  updateHangingPointLoadCapacity: (id, loadCapacity, reason) => {
    const { scene } = get()
    const oldHp = scene.hangingPoints.find((hp) => hp.id === id)
    if (!oldHp) return

    get().addAuditLog({
      operator: "当前用户",
      elementType: "hangingPoint",
      elementId: id,
      field: "loadCapacity",
      oldValue: oldHp.loadCapacity,
      newValue: loadCapacity,
      reason,
    })

    const newHps = scene.hangingPoints.map((hp) =>
      hp.id === id ? { ...hp, loadCapacity } : hp,
    )
    const newCollisions = runAllDetections(
      scene.lightBars,
      newHps,
      scene.fixtures,
      scene.actorRoutes,
    )
    set({
      scene: { ...scene, hangingPoints: newHps, collisions: newCollisions },
    })
  },

  updateHangingPointPosition: (id, position) => {
    const { scene } = get()
    const newHps = scene.hangingPoints.map((hp) =>
      hp.id === id ? { ...hp, position } : hp,
    )
    const newCollisions = runAllDetections(
      scene.lightBars,
      newHps,
      scene.fixtures,
      scene.actorRoutes,
    )
    set({
      scene: { ...scene, hangingPoints: newHps, collisions: newCollisions },
    })
  },

  updateActorRouteWaypoints: (id, waypoints, reason) => {
    const { scene } = get()
    const oldRoute = scene.actorRoutes.find((ar) => ar.id === id)
    if (!oldRoute) return

    get().addAuditLog({
      operator: "当前用户",
      elementType: "actorRoute",
      elementId: id,
      field: "waypoints",
      oldValue: oldRoute.waypoints,
      newValue: waypoints,
      reason,
    })

    const newRoutes = scene.actorRoutes.map((ar) =>
      ar.id === id ? { ...ar, waypoints } : ar,
    )
    const newCollisions = runAllDetections(
      scene.lightBars,
      scene.hangingPoints,
      scene.fixtures,
      newRoutes,
    )
    set({
      scene: { ...scene, actorRoutes: newRoutes, collisions: newCollisions },
    })
  },

  resolveCollision: (id, resolution) => {
    const { scene } = get()
    const newCollisions = scene.collisions.map((c) =>
      c.id === id ? { ...c, resolved: true, resolution } : c,
    )
    set({ scene: { ...scene, collisions: newCollisions } })
  },

  runCollisionDetection: () => {
    const { scene } = get()
    const newCollisions = runAllDetections(
      scene.lightBars,
      scene.hangingPoints,
      scene.fixtures,
      scene.actorRoutes,
    )
    set({ scene: { ...scene, collisions: newCollisions } })
  },

  addAuditLog: (log) => {
    const { scene } = get()
    const newLog: AuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    }
    set({
      scene: {
        ...scene,
        auditLogs: [...scene.auditLogs, newLog],
      },
    })
  },

  loadScene: (newScene) => {
    const collisions = runAllDetections(
      newScene.lightBars,
      newScene.hangingPoints,
      newScene.fixtures,
      newScene.actorRoutes,
    )
    set({ scene: { ...newScene, collisions }, selectedElement: null })
  },
}))
