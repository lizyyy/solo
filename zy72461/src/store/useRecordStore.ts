import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DetourRecord, Conflict, ChangeHistory, SummaryStats, StreetSummary, SourceData, RecordStatus } from '../types'
import { rampDatabase, nameAliasMap } from '../data/rampDatabase'

interface RecordState {
  records: DetourRecord[]
  currentRecord: DetourRecord | null
  filterStatus: string | null
  searchKeyword: string
  currentStep: number
  wizardRecordId: string | null

  setRecords: (records: DetourRecord[]) => void
  setCurrentRecord: (record: DetourRecord | null) => void
  setFilterStatus: (status: string | null) => void
  setSearchKeyword: (keyword: string) => void
  setCurrentStep: (step: number) => void
  setWizardRecordId: (id: string | null) => void

  importConstructionNotice: (data: Omit<SourceData, 'sourceDate'> & { street: string; sourceDate?: string }) => string
  matchRampRecord: (recordId: string) => { matched: boolean; conflicts: Conflict[]; status: RecordStatus; oldName?: string }
  resolveConflict: (recordId: string, conflictId: string, choice: 'construction' | 'ramp' | 'reject') => void
  resolveNameConflict: (recordId: string, confirmedName: string) => void
  supplementFromRamp: (recordId: string) => void
  addChangeHistory: (recordId: string, history: Omit<ChangeHistory, 'id' | 'recordId' | 'changedAt'>) => void
  getRecordById: (id: string) => DetourRecord | undefined
  getStats: () => SummaryStats
  getStreetSummaries: () => StreetSummary[]
  getExcludedFromSummary: () => DetourRecord[]
  getFilteredRecords: () => DetourRecord[]
}

function nowStr() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function findMatchingRamp(constructionNotice: SourceData): { ramp: SourceData; oldName?: string } | null {
  const directMatch = rampDatabase.find(
    (r) => r.communityName === constructionNotice.communityName && r.metroStation === constructionNotice.metroStation
  )
  if (directMatch) return { ramp: directMatch }

  const aliases = nameAliasMap[constructionNotice.communityName] || []
  for (const alias of aliases) {
    const aliasMatch = rampDatabase.find(
      (r) => r.communityName === alias && r.metroStation === constructionNotice.metroStation
    )
    if (aliasMatch) return { ramp: aliasMatch, oldName: alias }
  }

  return null
}

function detectConflicts(recordId: string, construction: SourceData, ramp: SourceData): Conflict[] {
  const conflicts: Conflict[] = []
  const fields: { key: keyof SourceData; label: string; format?: (v: any) => string }[] = [
    { key: 'communityName', label: '小区名称' },
    { key: 'detourRoute', label: '绕行路线' },
    { key: 'hasRamp', label: '有无障碍坡道', format: (v) => (v ? '有' : '无') },
    { key: 'rampCondition', label: '坡道状态' },
    { key: 'barrierFreeInfo', label: '无障碍设施说明' },
  ]

  fields.forEach(({ key, label, format }) => {
    const cVal = construction[key]
    const rVal = ramp[key]
    if (cVal !== rVal) {
      conflicts.push({
        id: `conf-${recordId}-${key}`,
        recordId,
        fieldName: key,
        fieldLabel: label,
        constructionValue: format ? format(cVal) : String(cVal),
        rampValue: format ? format(rVal) : String(rVal),
        status: 'pending',
      })
    }
  })

  return conflicts
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
  records: [],
  currentRecord: null,
  filterStatus: null,
  searchKeyword: '',
  currentStep: 1,
  wizardRecordId: null,

  setRecords: (records) => set({ records }),
  setCurrentRecord: (record) => set({ currentRecord: record }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setWizardRecordId: (id) => set({ wizardRecordId: id }),

  importConstructionNotice: (data) => {
    const now = nowStr()
    const id = `rec-${Date.now()}`
    const sourceDate = data.sourceDate || new Date().toISOString().split('T')[0]

    const constructionNotice: SourceData = {
      communityName: data.communityName,
      metroStation: data.metroStation,
      detourRoute: data.detourRoute,
      hasRamp: data.hasRamp,
      rampCondition: data.rampCondition,
      barrierFreeInfo: data.barrierFreeInfo,
      sourceDate,
    }

    const record: DetourRecord = {
      id,
      communityName: data.communityName,
      metroStation: data.metroStation,
      street: data.street,
      status: 'normal',
      constructionNotice,
      conflicts: [],
      changeHistory: [
        {
          id: `ch-${id}-1`,
          recordId: id,
          operator: '系统',
          action: '导入施工告示',
          reason: '施工告示首次导入系统',
          changedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }

    set((state) => ({
      records: [record, ...state.records],
      wizardRecordId: id,
    }))

    return id
  },

  matchRampRecord: (recordId) => {
    const record = get().records.find((r) => r.id === recordId)
    if (!record) return { matched: false, conflicts: [], status: record?.status || 'normal' }

    const matchResult = findMatchingRamp(record.constructionNotice)

    if (!matchResult) {
      const now = nowStr()
      const newHistory: ChangeHistory = {
        id: `ch-${recordId}-${Date.now()}`,
        recordId,
        operator: '系统',
        action: '匹配坡道记录',
        reason: '未找到匹配的无障碍坡道记录',
        impact: '该记录仅依据施工告示，标记为正常',
        changedAt: now,
      }

      set((state) => ({
        records: state.records.map((r) =>
          r.id === recordId
            ? { ...r, status: 'normal' as const, changeHistory: [...r.changeHistory, newHistory], updatedAt: now }
            : r
        ),
      }))

      return { matched: false, conflicts: [], status: 'normal' }
    }

    const { ramp, oldName } = matchResult
    const conflicts = detectConflicts(recordId, record.constructionNotice, ramp)

    let newStatus: RecordStatus = 'normal'
    let impactText = '自动匹配无障碍坡道记录，无冲突'
    let actionText = '匹配坡道记录'

    if (conflicts.some((c) => c.fieldName === 'communityName')) {
      newStatus = 'name_conflict'
      impactText = '该记录暂标记为待复核，不进入街道摘要'
      actionText = '检测名称冲突'
    } else if (conflicts.length > 0) {
      newStatus = 'data_conflict'
      impactText = '该记录暂不进入街道摘要，待人工确认'
      actionText = '检测口径冲突'
    }

    const now = nowStr()
    const newHistory: ChangeHistory = {
      id: `ch-${recordId}-${Date.now()}`,
      recordId,
      operator: '系统',
      action: actionText,
      fieldChanged: conflicts.length > 0 ? conflicts.map((c) => c.fieldLabel).join('、') : undefined,
      oldValue: conflicts.length > 0 ? conflicts.map((c) => c.constructionValue).join('；') : undefined,
      newValue: conflicts.length > 0 ? conflicts.map((c) => c.rampValue).join('；') : undefined,
      reason: conflicts.length === 0
        ? '自动匹配无障碍坡道记录，数据一致无冲突'
        : conflicts.some((c) => c.fieldName === 'communityName')
        ? '疑似同一小区新旧名称不一致，待市政巡检员复核'
        : `检测到${conflicts.length}处口径冲突，待老马确认`,
      impact: impactText,
      changedAt: now,
    }

    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              rampRecord: ramp,
              oldCommunityName: oldName,
              conflicts,
              status: newStatus,
              changeHistory: [...r.changeHistory, newHistory],
              updatedAt: now,
            }
          : r
      ),
    }))

    return { matched: true, conflicts, status: newStatus, oldName }
  },

  resolveConflict: (recordId, conflictId, choice) => {
    const now = nowStr()

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

        const noPendingConflicts = updatedConflicts.every((c) => c.status !== 'pending')
        const hasRejected = updatedConflicts.some((c) => c.status === 'rejected')
        const hasRampSupplement = updatedConflicts.some((c) => c.status === 'resolved_ramp')

        let newStatus = record.status
        if (noPendingConflicts && !hasRejected) {
          newStatus = hasRampSupplement ? 'ramp_supplemented' : 'completed'
        } else if (hasRejected) {
          newStatus = 'data_conflict'
        }

        const actionText = {
          construction: '确认施工告示口径',
          ramp: '确认坡道记录口径',
          reject: '驳回，待进一步核实',
        }[choice]

        const conflict = record.conflicts.find((c) => c.id === conflictId)

        let impactText = '继续处理剩余冲突项'
        if (noPendingConflicts) {
          if (hasRejected) {
            impactText = '该记录存在驳回待查项，保持待核实状态，不进入街道摘要'
          } else if (hasRampSupplement) {
            impactText = '该记录已补录坡道数据，复核完成，可进入街道摘要'
          } else {
            impactText = '该记录复核完成，可进入街道摘要'
          }
        }

        const newHistory: ChangeHistory = {
          id: `ch-${recordId}-${Date.now()}`,
          recordId,
          operator: '老马',
          action: actionText,
          fieldChanged: conflict?.fieldLabel,
          oldValue: choice === 'ramp' ? conflict?.constructionValue : conflict?.rampValue,
          newValue: choice === 'ramp' ? conflict?.rampValue : conflict?.constructionValue,
          reason: choice === 'reject' ? '双方说法不一致，需进一步现场核实' : '人工核对后确认以此口径为准',
          impact: impactText,
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
    const now = nowStr()

    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record

        const updatedConflicts = record.conflicts.map((c) => {
          if (c.fieldName === 'communityName') {
            return {
              ...c,
              status: 'resolved_construction' as const,
              resolvedBy: '市政巡检员',
              resolvedAt: now,
            }
          }
          return c
        })

        const remainingConflicts = updatedConflicts.filter((c) => c.status === 'pending')
        const hasRejected = updatedConflicts.some((c) => c.status === 'rejected')

        let newStatus = record.status
        let impactText = '名称冲突已解决，仍有其他冲突待处理，不进入街道摘要'
        if (remainingConflicts.length === 0 && !hasRejected) {
          newStatus = 'completed'
          impactText = '所有冲突已解决，该记录可进入街道摘要'
        } else if (hasRejected || remainingConflicts.length > 0) {
          newStatus = 'data_conflict'
          impactText = hasRejected
            ? '名称冲突已解决，但存在驳回待查项，保持待核实状态，不进入街道摘要'
            : '名称冲突已解决，仍有其他冲突待处理，不进入街道摘要'
        }

        const newHistory: ChangeHistory = {
          id: `ch-${recordId}-${Date.now()}`,
          recordId,
          operator: '市政巡检员',
          action: '确认小区名称',
          fieldChanged: '小区名称',
          oldValue: `${record.communityName} / ${record.oldCommunityName}`,
          newValue: confirmedName,
          reason: '经现场核实，确认小区标准名称',
          impact: impactText,
          changedAt: now,
        }

        return {
          ...record,
          communityName: confirmedName,
          conflicts: updatedConflicts,
          status: newStatus,
          changeHistory: [...record.changeHistory, newHistory],
          reviewer: '市政巡检员',
          updatedAt: now,
        }
      }),
    }))
  },

  supplementFromRamp: (recordId) => {
    const record = get().records.find((r) => r.id === recordId)
    if (!record || !record.rampRecord) return

    const now = nowStr()
    const ramp = record.rampRecord

    const newConflicts = record.conflicts.map((c) => {
      if (c.status !== 'pending') return c
      return {
        ...c,
        status: 'resolved_ramp' as const,
        resolvedBy: '老马',
        resolvedAt: now,
      }
    })

    const allResolved = newConflicts.every((c) => c.status !== 'pending')

    const changedFields = record.conflicts
      .filter((c) => c.status === 'pending')
      .map((c) => c.fieldLabel)

    const newHistory: ChangeHistory = {
      id: `ch-${recordId}-${Date.now()}`,
      recordId,
      operator: '老马',
      action: '补录坡道记录',
      fieldChanged: changedFields.length > 0 ? changedFields.join('、') : undefined,
      oldValue: record.constructionNotice.barrierFreeInfo,
      newValue: ramp.barrierFreeInfo,
      reason: '坡道记录为最新实地勘察数据，比施工告示更准确，以坡道记录口径更新',
      impact: allResolved
        ? '该记录已补录坡道数据，复核完成，可进入街道摘要'
        : '继续处理剩余冲突项',
      changedAt: now,
    }

    set((state) => ({
      records: state.records.map((r) => {
        if (r.id !== recordId) return r
        return {
          ...r,
          conflicts: newConflicts,
          status: allResolved ? 'ramp_supplemented' : r.status,
          finalSource: allResolved ? 'ramp' : r.finalSource,
          changeHistory: [...r.changeHistory, newHistory],
          reviewer: '老马',
          updatedAt: now,
        }
      }),
    }))
  },

  addChangeHistory: (recordId, history) => {
    const now = nowStr()

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

  getRecordById: (id) => {
    return get().records.find((r) => r.id === id)
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
    const records = get().records.filter((r) => {
      const validStatus = r.status === 'normal' || r.status === 'completed' || r.status === 'ramp_supplemented'
      const hasRejected = r.conflicts.some((c) => c.status === 'rejected')
      const hasPending = r.conflicts.some((c) => c.status === 'pending')
      return validStatus && !hasRejected && !hasPending
    })
    const streetMap = new Map<string, DetourRecord[]>()

    records.forEach((record) => {
      if (!streetMap.has(record.street)) {
        streetMap.set(record.street, [])
      }
      streetMap.get(record.street)!.push(record)
    })

    return Array.from(streetMap.entries()).map(([street, recs]) => ({
      street,
      count: recs.length,
      records: recs,
    }))
  },

  getExcludedFromSummary: () => {
    return get().records.filter((r) => {
      if (r.status === 'name_conflict' || r.status === 'data_conflict') {
        return true
      }
      const hasRejected = r.conflicts.some((c) => c.status === 'rejected')
      const hasPending = r.conflicts.some((c) => c.status === 'pending')
      return hasRejected || hasPending
    })
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
    }),
    {
      name: 'detour-record-store',
      partialize: (state) => ({
        records: state.records,
      }),
    }
  )
)
