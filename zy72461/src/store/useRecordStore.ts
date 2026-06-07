import { create } from 'zustand'
import { DetourRecord, Conflict, ChangeHistory, SummaryStats, StreetSummary } from '../types'
import { mockRecords } from '../data/mockData'

interface RecordState {
  records: DetourRecord[]
  currentRecord: DetourRecord | null
  filterStatus: string | null
  searchKeyword: string
  currentStep: number

  setRecords: (records: DetourRecord[]) => void
  setCurrentRecord: (record: DetourRecord | null) => void
  setFilterStatus: (status: string | null) => void
  setSearchKeyword: (keyword: string) => void
  setCurrentStep: (step: number) => void

  getRecordById: (id: string) => DetourRecord | undefined
  resolveConflict: (recordId: string, conflictId: string, choice: 'construction' | 'ramp' | 'reject') => void
  resolveNameConflict: (recordId: string, confirmedName: string) => void
  addChangeHistory: (recordId: string, history: Omit<ChangeHistory, 'id' | 'recordId' | 'changedAt'>) => void
  getStats: () => SummaryStats
  getStreetSummaries: () => StreetSummary[]
  getFilteredRecords: () => DetourRecord[]
}

export const useRecordStore = create<RecordState>((set, get) => ({
  records: mockRecords,
  currentRecord: null,
  filterStatus: null,
  searchKeyword: '',
  currentStep: 1,

  setRecords: (records) => set({ records }),
  setCurrentRecord: (record) => set({ currentRecord: record }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  setCurrentStep: (step) => set({ currentStep: step }),

  getRecordById: (id) => {
    return get().records.find((r) => r.id === id)
  },

  resolveConflict: (recordId, conflictId, choice) => {
    const now = new Date().toLocaleString('zh-CN', { hour12: false })

    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record

        const updatedConflicts = record.conflicts.map((conflict) => {
          if (conflict.id !== conflictId) return conflict

          const statusMap = {
            construction: 'resolved_construction' as const,
            ramp: 'resolved_ramp' as const,
            reject: 'rejected' as const,
          }

          return {
            ...conflict,
            status: statusMap[choice],
            resolvedBy: '老马',
            resolvedAt: now,
          }
        })

        const allResolved = updatedConflicts.every(
          (c) => c.status !== 'pending'
        )

        const hasRampSupplement = updatedConflicts.some(
          (c) => c.status === 'resolved_ramp'
        )

        let newStatus = record.status
        if (allResolved) {
          newStatus = hasRampSupplement ? 'ramp_supplemented' : 'completed'
        }

        const actionText = {
          construction: '确认施工告示口径',
          ramp: '确认坡道记录口径',
          reject: '驳回，待进一步核实',
        }[choice]

        const conflict = record.conflicts.find((c) => c.id === conflictId)

        const newHistory: ChangeHistory = {
          id: `ch-${recordId}-${Date.now()}`,
          recordId,
          operator: '老马',
          action: actionText,
          fieldChanged: conflict?.fieldLabel,
          oldValue: choice === 'ramp' ? conflict?.constructionValue : conflict?.rampValue,
          newValue: choice === 'ramp' ? conflict?.rampValue : conflict?.constructionValue,
          reason: choice === 'reject' ? '双方说法不一致，需进一步现场核实' : '人工核对后确认以此口径为准',
          impact: allResolved ? '该记录复核完成，可进入街道摘要' : '继续处理剩余冲突项',
          changedAt: now,
        }

        return {
          ...record,
          conflicts: updatedConflicts,
          status: newStatus,
          changeHistory: [...record.changeHistory, newHistory],
          finalSource: choice === 'reject' ? undefined : choice,
          reviewer: '老马',
          updatedAt: now,
        }
      }),
    }))
  },

  resolveNameConflict: (recordId, confirmedName) => {
    const now = new Date().toLocaleString('zh-CN', { hour12: false })

    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record

        const updatedConflicts = record.conflicts.map((c) => ({
          ...c,
          status: 'resolved_construction' as const,
          resolvedBy: '市政巡检员',
          resolvedAt: now,
        }))

        const newHistory: ChangeHistory = {
          id: `ch-${recordId}-${Date.now()}`,
          recordId,
          operator: '市政巡检员',
          action: '确认小区名称',
          fieldChanged: '小区名称',
          oldValue: `${record.communityName} / ${record.oldCommunityName}`,
          newValue: confirmedName,
          reason: '经现场核实，确认小区标准名称',
          impact: '名称冲突已解决，该记录可进入街道摘要',
          changedAt: now,
        }

        return {
          ...record,
          communityName: confirmedName,
          conflicts: updatedConflicts,
          status: 'completed',
          changeHistory: [...record.changeHistory, newHistory],
          reviewer: '市政巡检员',
          updatedAt: now,
        }
      }),
    }))
  },

  addChangeHistory: (recordId, history) => {
    const now = new Date().toLocaleString('zh-CN', { hour12: false })

    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record

        const newHistory: ChangeHistory = {
          ...history,
          id: `ch-${recordId}-${Date.now()}`,
          recordId,
          changedAt: now,
        }

        return {
          ...record,
          changeHistory: [...record.changeHistory, newHistory],
          updatedAt: now,
        }
      }),
    }))
  },

  getStats: () => {
    const records = get().records
    return {
      total: records.length,
      normal: records.filter((r) => r.status === 'normal').length,
      nameConflict: records.filter((r) => r.status === 'name_conflict').length,
      dataConflict: records.filter((r) => r.status === 'data_conflict').length,
      rampSupplemented: records.filter((r) => r.status === 'ramp_supplemented').length,
      completed: records.filter((r) => r.status === 'completed').length,
    }
  },

  getStreetSummaries: () => {
    const records = get().records
    const streetMap = new Map<string, DetourRecord[]>()

    records.forEach((record) => {
      if (!streetMap.has(record.street)) {
        streetMap.set(record.street, [])
      }
      streetMap.get(record.street)!.push(record)
    })

    return Array.from(streetMap.entries()).map(([street, records]) => ({
      street,
      count: records.length,
      records,
    }))
  },

  getFilteredRecords: () => {
    const { records, filterStatus, searchKeyword } = get()

    return records.filter((record) => {
      if (filterStatus && record.status !== filterStatus) return false
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        return (
          record.communityName.toLowerCase().includes(keyword) ||
          record.metroStation.toLowerCase().includes(keyword) ||
          record.street.toLowerCase().includes(keyword)
        )
      }
      return true
    })
  },
}))
