import { create } from "zustand"
import type { Scheme, Building, SolarPanel, Inverter, ConflictRecord } from "@/types"
import { sampleScheme } from "@/utils/sampleData"
import { validateBuilding, validatePanel, validateInverter } from "@/utils/dataValidator"

interface PendingImport {
  buildings: Building[]
  panels: SolarPanel[]
  inverters: Inverter[]
}

interface SchemeStore {
  currentScheme: Scheme
  savedSchemes: Scheme[]
  conflicts: ConflictRecord[]
  pendingImport: PendingImport

  loadSample: () => void
  updateSchemeParams: (params: Partial<Pick<Scheme, "latitude" | "longitude" | "date" | "time" | "sunAltitude" | "sunAzimuth" | "name" | "note">>) => void
  updateBuilding: (id: string, data: Partial<Building>) => void
  updatePanel: (id: string, data: Partial<SolarPanel>) => void
  updateInverter: (id: string, data: Partial<Inverter>) => void
  addBuildings: (buildings: Building[]) => void
  addPanels: (panels: SolarPanel[]) => void
  addInverters: (inverters: Inverter[]) => void
  removeBuilding: (id: string) => void
  removePanel: (id: string) => void
  removeInverter: (id: string) => void
  saveScheme: () => void
  loadScheme: (id: string) => void
  deleteScheme: (id: string) => void
  renameScheme: (id: string, name: string) => void
  setConflictsAndPending: (conflicts: ConflictRecord[], pending: PendingImport) => void
  resolveConflict: (id: string, decision: "keep_existing" | "use_imported" | "merge") => void
  applyImportedData: () => void
  cancelImport: () => void
  recalcShadowCoverage: () => void
  loadFromLocalStorage: () => void
}

function revalidate(scheme: Scheme): Scheme {
  return {
    ...scheme,
    buildings: scheme.buildings.map((b) => {
      const { status, note } = validateBuilding(b)
      return { ...b, status, anomalyNote: note }
    }),
    panels: scheme.panels.map((p) => {
      const { status, note } = validatePanel(p)
      return { ...p, status, anomalyNote: note }
    }),
    inverters: scheme.inverters.map((i) => {
      const { status, note } = validateInverter(i)
      return { ...i, status, anomalyNote: note }
    }),
  }
}

function calcShadowForPanel(panel: SolarPanel, buildings: Building[], sunAlt: number, sunAzimuth: number): number {
  const sunRad = (sunAzimuth * Math.PI) / 180
  const altRad = (sunAlt * Math.PI) / 180
  const shadowLen = sunAlt > 0 ? 1 / Math.tan(altRad) : 0

  let coverage = 0
  buildings.forEach((b) => {
    const dx = panel.x - b.x
    const dy = panel.y - b.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.1) return

    const angleToPanel = Math.atan2(dy, dx)
    const angleDiff = Math.abs(angleToPanel - sunRad)

    const effectiveShadow = b.height * shadowLen
    if (effectiveShadow > dist && angleDiff < Math.PI / 3) {
      const overlap = Math.min(1, (effectiveShadow - dist) / 10)
      coverage += overlap * 0.3
    }
  })

  return Math.min(1, Math.max(0, coverage))
}

export const useSchemeStore = create<SchemeStore>((set, get) => ({
  currentScheme: revalidate(sampleScheme),
  savedSchemes: [],
  conflicts: [],
  pendingImport: { buildings: [], panels: [], inverters: [] },

  loadSample: () => {
    set({ currentScheme: revalidate(sampleScheme), conflicts: [], pendingImport: { buildings: [], panels: [], inverters: [] } })
  },

  updateSchemeParams: (params) => {
    set((state) => {
      const updated = { ...state.currentScheme, ...params, updatedAt: new Date().toISOString() }
      return { currentScheme: revalidate(updated) }
    })
    get().recalcShadowCoverage()
  },

  updateBuilding: (id, data) => {
    set((state) => {
      const buildings = state.currentScheme.buildings.map((b) =>
        b.id === id ? { ...b, ...data } : b
      )
      const updated = { ...state.currentScheme, buildings, updatedAt: new Date().toISOString() }
      return { currentScheme: revalidate(updated) }
    })
    get().recalcShadowCoverage()
  },

  updatePanel: (id, data) => {
    set((state) => {
      const panels = state.currentScheme.panels.map((p) =>
        p.id === id ? { ...p, ...data } : p
      )
      const updated = { ...state.currentScheme, panels, updatedAt: new Date().toISOString() }
      return { currentScheme: revalidate(updated) }
    })
    get().recalcShadowCoverage()
  },

  updateInverter: (id, data) => {
    set((state) => {
      const inverters = state.currentScheme.inverters.map((i) =>
        i.id === id ? { ...i, ...data } : i
      )
      const updated = { ...state.currentScheme, inverters, updatedAt: new Date().toISOString() }
      return { currentScheme: revalidate(updated) }
    })
  },

  addBuildings: (buildings) => {
    set((state) => {
      const updated = {
        ...state.currentScheme,
        buildings: [...state.currentScheme.buildings, ...buildings],
        updatedAt: new Date().toISOString(),
      }
      return { currentScheme: revalidate(updated) }
    })
    get().recalcShadowCoverage()
  },

  addPanels: (panels) => {
    set((state) => {
      const updated = {
        ...state.currentScheme,
        panels: [...state.currentScheme.panels, ...panels],
        updatedAt: new Date().toISOString(),
      }
      return { currentScheme: revalidate(updated) }
    })
    get().recalcShadowCoverage()
  },

  addInverters: (inverters) => {
    set((state) => {
      const updated = {
        ...state.currentScheme,
        inverters: [...state.currentScheme.inverters, ...inverters],
        updatedAt: new Date().toISOString(),
      }
      return { currentScheme: revalidate(updated) }
    })
  },

  removeBuilding: (id) => {
    set((state) => {
      const updated = {
        ...state.currentScheme,
        buildings: state.currentScheme.buildings.filter((b) => b.id !== id),
        updatedAt: new Date().toISOString(),
      }
      return { currentScheme: revalidate(updated) }
    })
    get().recalcShadowCoverage()
  },

  removePanel: (id) => {
    set((state) => {
      const updated = {
        ...state.currentScheme,
        panels: state.currentScheme.panels.filter((p) => p.id !== id),
        updatedAt: new Date().toISOString(),
      }
      return { currentScheme: revalidate(updated) }
    })
    get().recalcShadowCoverage()
  },

  removeInverter: (id) => {
    set((state) => {
      const updated = {
        ...state.currentScheme,
        inverters: state.currentScheme.inverters.filter((i) => i.id !== id),
        updatedAt: new Date().toISOString(),
      }
      return { currentScheme: revalidate(updated) }
    })
  },

  saveScheme: () => {
    const { currentScheme, savedSchemes } = get()
    const existing = savedSchemes.findIndex((s) => s.id === currentScheme.id)
    const updatedScheme = { ...currentScheme, updatedAt: new Date().toISOString() }
    let newSaved: Scheme[]
    if (existing >= 0) {
      newSaved = savedSchemes.map((s) => (s.id === currentScheme.id ? updatedScheme : s))
    } else {
      newSaved = [...savedSchemes, updatedScheme]
    }
    set({ savedSchemes: newSaved })
    try {
      localStorage.setItem("pv-schemes", JSON.stringify(newSaved))
    } catch { /* ignore */ }
  },

  loadScheme: (id) => {
    const { savedSchemes } = get()
    const found = savedSchemes.find((s) => s.id === id)
    if (found) {
      set({ currentScheme: revalidate(found), conflicts: [], pendingImport: { buildings: [], panels: [], inverters: [] } })
    }
  },

  deleteScheme: (id) => {
    set((state) => {
      const newSaved = state.savedSchemes.filter((s) => s.id !== id)
      try {
        localStorage.setItem("pv-schemes", JSON.stringify(newSaved))
      } catch { /* ignore */ }
      return { savedSchemes: newSaved }
    })
  },

  renameScheme: (id, name) => {
    set((state) => {
      const newSaved = state.savedSchemes.map((s) => (s.id === id ? { ...s, name } : s))
      try {
        localStorage.setItem("pv-schemes", JSON.stringify(newSaved))
      } catch { /* ignore */ }
      return { savedSchemes: newSaved }
    })
  },

  setConflictsAndPending: (conflicts, pending) => set({ conflicts, pendingImport: pending }),

  resolveConflict: (id, decision) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id ? { ...c, resolved: true, userDecision: decision } : c
      ),
    }))
  },

  applyImportedData: () => {
    const { conflicts, pendingImport, currentScheme } = get()
    let scheme = { ...currentScheme }
    let buildings = [...scheme.buildings]
    let panels = [...scheme.panels]
    let inverters = [...scheme.inverters]

    const conflictEntityIds = new Map<string, "keep_existing" | "use_imported" | "merge">()
    conflicts.forEach((c) => {
      if (c.resolved && c.userDecision) {
        conflictEntityIds.set(`${c.entityType}:${c.entityId}`, c.userDecision)
      }
    })

    const importedBuildingsHandled = new Set<string>()
    const importedPanelsHandled = new Set<string>()
    const importedInvertersHandled = new Set<string>()

    conflicts.forEach((c) => {
      if (!c.resolved || !c.userDecision) return
      if (c.userDecision === "keep_existing") {
        if (c.entityType === "building") {
          const matchName = (c.existingData as Partial<Building>).name
          const idx = pendingImport.buildings.findIndex((b) => b.name === matchName)
          if (idx >= 0) importedBuildingsHandled.add(pendingImport.buildings[idx].id)
        } else if (c.entityType === "panel") {
          const matchName = (c.existingData as Partial<SolarPanel>).name
          const idx = pendingImport.panels.findIndex((p) => p.name === matchName)
          if (idx >= 0) importedPanelsHandled.add(pendingImport.panels[idx].id)
        } else if (c.entityType === "inverter") {
          const matchName = (c.existingData as Partial<Inverter>).name
          const idx = pendingImport.inverters.findIndex((i) => i.name === matchName)
          if (idx >= 0) importedInvertersHandled.add(pendingImport.inverters[idx].id)
        }
      } else if (c.userDecision === "use_imported") {
        if (c.entityType === "building") {
          const imported = pendingImport.buildings.find(
            (b) => b.name === (c.existingData as Partial<Building>).name
          )
          if (imported) {
            importedBuildingsHandled.add(imported.id)
            buildings = buildings.map((b) =>
              b.id === c.entityId ? { ...b, ...imported } : b
            )
          }
        } else if (c.entityType === "panel") {
          const imported = pendingImport.panels.find(
            (p) => p.name === (c.existingData as Partial<SolarPanel>).name
          )
          if (imported) {
            importedPanelsHandled.add(imported.id)
            panels = panels.map((p) =>
              p.id === c.entityId ? { ...p, ...imported } : p
            )
          }
        } else if (c.entityType === "inverter") {
          const imported = pendingImport.inverters.find(
            (i) => i.name === (c.existingData as Partial<Inverter>).name
          )
          if (imported) {
            importedInvertersHandled.add(imported.id)
            inverters = inverters.map((i) =>
              i.id === c.entityId ? { ...i, ...imported } : i
            )
          }
        }
      } else if (c.userDecision === "merge") {
        if (c.entityType === "building") {
          const existing = buildings.find((b) => b.id === c.entityId)
          const imported = pendingImport.buildings.find(
            (b) => b.name === (c.existingData as Partial<Building>).name
          )
          if (existing && imported) {
            importedBuildingsHandled.add(imported.id)
            const mergedNote = `[合并] 原X=${existing.x},Y=${existing.y}; 导入X=${imported.x},Y=${imported.y}`
            buildings = buildings.map((b) =>
              b.id === c.entityId
                ? {
                    ...b,
                    x: imported.x,
                    y: imported.y,
                    width: Math.max(b.width, imported.width),
                    depth: Math.max(b.depth, imported.depth),
                    height: Math.max(b.height, imported.height),
                    anomalyNote: mergedNote,
                    aliasName: imported.name,
                  }
                : b
            )
          }
        } else if (c.entityType === "inverter") {
          const existing = inverters.find((i) => i.id === c.entityId)
          const imported = pendingImport.inverters.find(
            (i) => i.name === (c.existingData as Partial<Inverter>).name
              || (existing && i.aliasName === existing.name)
          )
          if (existing && imported) {
            importedInvertersHandled.add(imported.id)
            inverters = inverters.map((i) =>
              i.id === c.entityId
                ? { ...i, aliasName: imported.name || i.aliasName, anomalyNote: "[合并] 已合并别名记录" }
                : i
            )
          }
        }
      }
    })

    const newBuildings = pendingImport.buildings.filter((b) => !importedBuildingsHandled.has(b.id))
    const newPanels = pendingImport.panels.filter((p) => !importedPanelsHandled.has(p.id))
    const newInverters = pendingImport.inverters.filter((i) => !importedInvertersHandled.has(i.id))

    buildings = [...buildings, ...newBuildings]
    panels = [...panels, ...newPanels]
    inverters = [...inverters, ...newInverters]

    const finalScheme = revalidate({
      ...scheme,
      buildings,
      panels,
      inverters,
      updatedAt: new Date().toISOString(),
    })
    set({
      currentScheme: finalScheme,
      conflicts: [],
      pendingImport: { buildings: [], panels: [], inverters: [] },
    })
    get().recalcShadowCoverage()
  },

  cancelImport: () => {
    set({
      conflicts: [],
      pendingImport: { buildings: [], panels: [], inverters: [] },
    })
  },

  recalcShadowCoverage: () => {
    set((state) => {
      const { sunAltitude, sunAzimuth, buildings, panels } = state.currentScheme
      const updatedPanels = panels.map((p) => ({
        ...p,
        shadowCoverage: calcShadowForPanel(p, buildings, sunAltitude, sunAzimuth),
      }))
      return {
        currentScheme: {
          ...state.currentScheme,
          panels: updatedPanels,
          updatedAt: new Date().toISOString(),
        },
      }
    })
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem("pv-schemes")
      if (raw) {
        const saved: Scheme[] = JSON.parse(raw)
        set({ savedSchemes: saved })
      }
    } catch { /* ignore */ }
  },
}))
