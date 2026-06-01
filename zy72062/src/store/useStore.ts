import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Entity,
  Anomaly,
  AnomalyType,
  AnomalyStatus,
  Supplement,
  OperationLog,
  ViewSnapshot,
  EquityLink,
} from '../types'

interface AppState {
  entities: Entity[]
  anomalies: Anomaly[]
  supplements: Supplement[]
  operationLogs: OperationLog[]
  viewSnapshots: ViewSnapshot[]
  equityLinks: EquityLink[]
  currentView: { zoom: number; panX: number; panY: number }
  selectedEntityId: string | null
  anomalyFilter: AnomalyType | null

  addEntity: (entity: Omit<Entity, 'id'>) => void
  updateEntity: (id: string, updates: Partial<Entity>) => void
  removeEntity: (id: string) => void
  addAnomaly: (anomaly: Omit<Anomaly, 'id'>) => void
  updateAnomalyStatus: (id: string, status: AnomalyStatus) => void
  addSupplement: (supplement: Omit<Supplement, 'id'>) => void
  addOperationLog: (log: Omit<OperationLog, 'id' | 'timestamp'>) => void
  saveViewSnapshot: (name: string) => void
  loadViewSnapshot: (id: string) => void
  setCurrentView: (view: Partial<{ zoom: number; panX: number; panY: number }>) => void
  setSelectedEntityId: (id: string | null) => void
  setAnomalyFilter: (filter: AnomalyType | null) => void
  importData: (data: {
    entities?: Omit<Entity, 'id'>[]
    equityLinks?: Omit<EquityLink, 'id'>[]
    sourceFile: string
  }) => void
  mergeEntities: (sourceId: string, targetId: string) => void
  exportData: () => {
    entities: Entity[]
    anomalies: Anomaly[]
    supplements: Supplement[]
    equityLinks: EquityLink[]
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      entities: [],
      anomalies: [],
      supplements: [],
      operationLogs: [],
      viewSnapshots: [],
      equityLinks: [],
      currentView: { zoom: 1, panX: 0, panY: 0 },
      selectedEntityId: null,
      anomalyFilter: null,

      addEntity: (entity) => {
        const newEntity: Entity = { ...entity, id: crypto.randomUUID() }
        set((state) => ({
          entities: [...state.entities, newEntity],
        }))
        get().addOperationLog({
          action: 'import',
          targetId: newEntity.id,
          detail: `新增实体: ${newEntity.name}`,
        })
      },

      updateEntity: (id, updates) => {
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }))
        get().addOperationLog({
          action: 'edit',
          targetId: id,
          detail: `编辑实体: ${Object.keys(updates).join(', ')}`,
        })
      },

      removeEntity: (id) => {
        const entity = get().entities.find((e) => e.id === id)
        set((state) => ({
          entities: state.entities.filter((e) => e.id !== id),
          equityLinks: state.equityLinks.filter(
            (l) => l.sourceId !== id && l.targetId !== id
          ),
        }))
        if (entity) {
          get().addOperationLog({
            action: 'edit',
            targetId: id,
            detail: `删除实体: ${entity.name}`,
          })
        }
      },

      addAnomaly: (anomaly) => {
        const newAnomaly: Anomaly = { ...anomaly, id: crypto.randomUUID() }
        set((state) => ({
          anomalies: [...state.anomalies, newAnomaly],
        }))
      },

      updateAnomalyStatus: (id, status) => {
        set((state) => ({
          anomalies: state.anomalies.map((a) =>
            a.id === id ? { ...a, status } : a
          ),
        }))
        const anomaly = get().anomalies.find((a) => a.id === id)
        if (anomaly) {
          get().addOperationLog({
            action: 'mark_anomaly',
            targetId: id,
            detail: `异常状态变更为: ${status}`,
          })
        }
      },

      addSupplement: (supplement) => {
        const newSupplement: Supplement = {
          ...supplement,
          id: crypto.randomUUID(),
        }
        set((state) => ({
          supplements: [...state.supplements, newSupplement],
        }))
        get().addOperationLog({
          action: 'supplement',
          targetId: newSupplement.entityId,
          detail: `补充信息: ${newSupplement.supplementedContent}`,
        })
      },

      addOperationLog: (log) => {
        const newLog: OperationLog = {
          ...log,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        }
        set((state) => ({
          operationLogs: [...state.operationLogs, newLog],
        }))
      },

      saveViewSnapshot: (name) => {
        const { currentView } = get()
        const snapshot: ViewSnapshot = {
          id: crypto.randomUUID(),
          name,
          zoom: currentView.zoom,
          panX: currentView.panX,
          panY: currentView.panY,
          savedAt: new Date().toISOString(),
        }
        set((state) => ({
          viewSnapshots: [...state.viewSnapshots, snapshot],
        }))
        get().addOperationLog({
          action: 'save_view',
          targetId: snapshot.id,
          detail: `保存视图: ${name}`,
        })
      },

      loadViewSnapshot: (id) => {
        const snapshot = get().viewSnapshots.find((s) => s.id === id)
        if (snapshot) {
          set({
            currentView: {
              zoom: snapshot.zoom,
              panX: snapshot.panX,
              panY: snapshot.panY,
            },
          })
          get().addOperationLog({
            action: 'save_view',
            targetId: id,
            detail: `加载视图: ${snapshot.name}`,
          })
        }
      },

      setCurrentView: (view) => {
        set((state) => ({
          currentView: { ...state.currentView, ...view },
        }))
      },

      setSelectedEntityId: (id) => {
        set({ selectedEntityId: id })
      },

      setAnomalyFilter: (filter) => {
        set({ anomalyFilter: filter })
      },

      importData: (data) => {
        const newEntities: Entity[] = (data.entities ?? []).map((e) => ({
          ...e,
          id: crypto.randomUUID(),
        }))
        const newLinks: EquityLink[] = (data.equityLinks ?? []).map((l) => ({
          ...l,
          id: crypto.randomUUID(),
        }))
        set((state) => ({
          entities: [...state.entities, ...newEntities],
          equityLinks: [...state.equityLinks, ...newLinks],
        }))
        get().addOperationLog({
          action: 'import',
          targetId: data.sourceFile,
          detail: `导入数据: ${newEntities.length} 个实体, ${newLinks.length} 条股权关系`,
        })
      },

      mergeEntities: (sourceId, targetId) => {
        const source = get().entities.find((e) => e.id === sourceId)
        const target = get().entities.find((e) => e.id === targetId)
        if (!source || !target) return

        const mergedAliases = Array.from(
          new Set([...target.alias, source.name, ...source.alias])
        )

        set((state) => ({
          entities: state.entities
            .map((e) =>
              e.id === targetId
                ? { ...e, alias: mergedAliases, notes: e.notes || source.notes }
                : e
            )
            .filter((e) => e.id !== sourceId),
          equityLinks: state.equityLinks.map((l) => ({
            ...l,
            sourceId: l.sourceId === sourceId ? targetId : l.sourceId,
            targetId: l.targetId === sourceId ? targetId : l.targetId,
          })),
        }))

        get().addOperationLog({
          action: 'merge_entity',
          targetId: targetId,
          detail: `合并实体: ${source.name} → ${target.name}`,
        })
      },

      exportData: () => {
        const { entities, anomalies, supplements, equityLinks } = get()
        return { entities, anomalies, supplements, equityLinks }
      },
    }),
    {
      name: 'equity-starmap-store',
    }
  )
)
