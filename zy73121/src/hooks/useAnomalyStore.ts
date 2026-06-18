import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnomalyRecord, ShipRecord, Remark, FilterProfile, AnomalyType, RecordStatus } from '@/utils/types'
import { generateMockAnomalies, generateMockShipRecords, generateMockRemarks } from '@/utils/mockData'
import { dedupAnomalies, dedupShipRecords } from '@/utils/dedup'
import { detectCoordReversal } from '@/utils/coordCheck'

interface ImportResult {
  added: number
  skipped: number
  boundary: number
  suspended: number
}

interface AnomalyStore {
  anomalies: AnomalyRecord[]
  shipRecords: ShipRecord[]
  remarks: Remark[]
  filter: FilterProfile
  initialized: boolean

  initialize: () => void
  setFilter: (filter: Partial<FilterProfile>) => void
  resetFilter: () => void
  updateAnomalyStatus: (id: string, status: RecordStatus) => void
  addRemark: (recordId: string, author: string, content: string) => void
  importShipRecords: (records: ShipRecord[]) => ImportResult
  importAnomalies: (records: AnomalyRecord[]) => ImportResult
  getAnomalyById: (id: string) => AnomalyRecord | undefined
  getShipRecordsByAnomalyId: (anomalyId: string) => ShipRecord[]
  getRemarksByRecordId: (recordId: string) => Remark[]
  getFilteredAnomalies: () => AnomalyRecord[]
}

const defaultFilter: FilterProfile = {
  buoyId: '',
  anomalyType: '' as AnomalyType | '',
  status: '' as RecordStatus | '',
  dateFrom: '',
  dateTo: '',
  applyToExport: true,
}

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const useAnomalyStore = create<AnomalyStore>()(
  persist(
    (set, get) => ({
      anomalies: [],
      shipRecords: [],
      remarks: [],
      filter: { ...defaultFilter },
      initialized: false,

      initialize: () => {
        const state = get()
        if (state.initialized && state.anomalies.length > 0) return
        const anomalies = generateMockAnomalies(25)
        const shipRecords = generateMockShipRecords(anomalies)
        const remarks = generateMockRemarks(anomalies)
        set({ anomalies, shipRecords, remarks, initialized: true })
      },

      setFilter: (partial) => {
        set((s) => ({ filter: { ...s.filter, ...partial } }))
      },

      resetFilter: () => {
        set({ filter: { ...defaultFilter } })
      },

      updateAnomalyStatus: (id, status) => {
        set((s) => ({
          anomalies: s.anomalies.map((a) =>
            a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a
          ),
        }))
      },

      addRemark: (recordId, author, content) => {
        const remark: Remark = {
          id: uuid(),
          recordId,
          author,
          content,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ remarks: [...s.remarks, remark] }))
      },

      importShipRecords: (records) => {
        const state = get()
        const { toAdd, skipped } = dedupShipRecords(state.shipRecords, records)
        let suspended = 0
        let boundary = 0
        const newAnomalies: AnomalyRecord[] = []
        const newRemarks: Remark[] = []

        for (const rec of toAdd) {
          if (rec.isBoundarySample) boundary++
          const coordCheck = detectCoordReversal(rec.recordLat, rec.recordLng)
          if (coordCheck.reversed) {
            suspended++
            newRemarks.push({
              id: uuid(),
              recordId: rec.linkedAnomalyId,
              author: '系统',
              content: `系统检测：船上记录经纬度疑似反写 - ${coordCheck.reason}`,
              createdAt: new Date().toISOString(),
            })
          }
        }

        const anomalyIdsToAdd = toAdd.map((r) => r.linkedAnomalyId)
        for (const aId of anomalyIdsToAdd) {
          const existing = state.anomalies.find((a) => a.id === aId)
          if (!existing) {
            newAnomalies.push({
              id: aId,
              buoyId: toAdd.find((r) => r.linkedAnomalyId === aId)?.buoyId || 'UNKNOWN',
              sensorTimestamp: toAdd.find((r) => r.linkedAnomalyId === aId)?.recordTimestamp || new Date().toISOString(),
              sensorLat: 0,
              sensorLng: 0,
              waterTemp: 0,
              salinity: 0,
              dissolvedOxygen: 0,
              phValue: 0,
              anomalyType: 'MULTI_ANOMALY',
              status: suspended > 0 ? 'SUSPENDED' : 'UNCONFIRMED',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
        }

        set((s) => ({
          shipRecords: [...s.shipRecords, ...toAdd],
          anomalies: [...s.anomalies, ...newAnomalies],
          remarks: [...s.remarks, ...newRemarks],
        }))

        return { added: toAdd.length, skipped: skipped.length, boundary, suspended }
      },

      importAnomalies: (records) => {
        const state = get()
        const { toAdd, skipped } = dedupAnomalies(state.anomalies, records)
        let suspended = 0
        const newRemarks: Remark[] = []

        for (const rec of toAdd) {
          const coordCheck = detectCoordReversal(rec.sensorLat, rec.sensorLng)
          if (coordCheck.reversed) {
            suspended++
            rec.status = 'SUSPENDED'
            newRemarks.push({
              id: uuid(),
              recordId: rec.id,
              author: '系统',
              content: `系统检测：经纬度疑似反写 - ${coordCheck.reason}`,
              createdAt: new Date().toISOString(),
            })
          }
        }

        set((s) => ({
          anomalies: [...s.anomalies, ...toAdd],
          remarks: [...s.remarks, ...newRemarks],
        }))

        return { added: toAdd.length, skipped: skipped.length, boundary: 0, suspended }
      },

      getAnomalyById: (id) => {
        return get().anomalies.find((a) => a.id === id)
      },

      getShipRecordsByAnomalyId: (anomalyId) => {
        return get().shipRecords.filter((r) => r.linkedAnomalyId === anomalyId)
      },

      getRemarksByRecordId: (recordId) => {
        return get().remarks.filter((r) => r.recordId === recordId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      },

      getFilteredAnomalies: () => {
        const { anomalies, filter } = get()
        return anomalies.filter((r) => {
          if (filter.buoyId && r.buoyId !== filter.buoyId) return false
          if (filter.anomalyType && r.anomalyType !== filter.anomalyType) return false
          if (filter.status && r.status !== filter.status) return false
          if (filter.dateFrom && r.sensorTimestamp < filter.dateFrom) return false
          if (filter.dateTo && r.sensorTimestamp > filter.dateTo + 'T23:59:59') return false
          return true
        })
      },
    }),
    {
      name: 'buoy-anomaly-store',
    }
  )
)
