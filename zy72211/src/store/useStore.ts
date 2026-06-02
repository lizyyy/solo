import { create } from 'zustand'
import type {
  TrialRecord,
  ConflictRecord,
  AuditRecord,
  RiskReview,
  SummarySnapshot,
  WorkflowStep,
  ConflictResolution,
  RiskOpinion,
} from '@/types'

const now = () => new Date().toISOString()

const initialRecords: TrialRecord[] = [
  {
    id: 'rec-001',
    name: '2024-Q4 利息收入-A档',
    amount: 1250000,
    status: '正常',
    remark: '',
    source: '顺延说明',
    caliber: '新口径',
    createdAt: '2024-12-20T09:00:00Z',
    updatedAt: '2024-12-20T09:00:00Z',
  },
  {
    id: 'rec-002',
    name: '2024-Q4 利息收入-B档冲正',
    amount: 0,
    status: '待风控复核',
    remark: '已冲正',
    source: '顺延说明',
    caliber: '新口径',
    createdAt: '2024-12-20T09:05:00Z',
    updatedAt: '2024-12-20T09:05:00Z',
  },
  {
    id: 'rec-003',
    name: '2024-Q3 尾差补录-基础资产池',
    amount: 3500,
    status: '尾差补录',
    remark: '尾差调整条补录',
    source: '尾差调整条',
    caliber: '旧口径',
    createdAt: '2024-12-21T14:30:00Z',
    updatedAt: '2024-12-21T14:30:00Z',
  },
]

const initialConflicts: ConflictRecord[] = [
  {
    id: 'conf-001',
    recordId: 'rec-003',
    holidayEvidence: '节假日顺延说明中该笔金额为 0，按新口径已结清',
    adjustmentEvidence: '尾差调整条显示该笔尚有 3500 元差额，旧口径未结清',
    conflictField: '金额',
    resolution: '待裁决',
    resolvedBy: '',
    resolvedAt: '',
    resolveReason: '',
  },
]

const initialAudits: AuditRecord[] = [
  {
    id: 'aud-001',
    recordId: 'rec-001',
    operator: '系统',
    action: '导入',
    detail: '节假日顺延说明导入：2024-Q4 利息收入-A档，金额 1,250,000',
    reason: '节假日顺延说明首次导入',
    impactResult: '新增正常记录',
    operatedAt: '2024-12-20T09:00:00Z',
  },
  {
    id: 'aud-002',
    recordId: 'rec-002',
    operator: '系统',
    action: '导入',
    detail: '节假日顺延说明导入：2024-Q4 利息收入-B档冲正，金额 0，备注"已冲正"',
    reason: '节假日顺延说明首次导入',
    impactResult: '新增待风控复核记录',
    operatedAt: '2024-12-20T09:05:00Z',
  },
  {
    id: 'aud-003',
    recordId: 'rec-003',
    operator: '阿芬',
    action: '补录',
    detail: '尾差调整条补录：2024-Q3 尾差补录-基础资产池，金额 3,500，旧口径',
    reason: '对账运营阿芬补看尾差调整条',
    impactResult: '新增尾差补录记录，触发冲突检测',
    operatedAt: '2024-12-21T14:30:00Z',
  },
]

const initialRiskReviews: RiskReview[] = []

const initialSummaries: SummarySnapshot[] = []

interface AppState {
  records: TrialRecord[]
  conflicts: ConflictRecord[]
  audits: AuditRecord[]
  riskReviews: RiskReview[]
  summaries: SummarySnapshot[]
  currentStep: WorkflowStep

  importHolidayData: (records: Omit<TrialRecord, 'id' | 'createdAt' | 'updatedAt'>[]) => void
  supplementAdjustment: (record: Omit<TrialRecord, 'id' | 'createdAt' | 'updatedAt'>) => void
  resolveConflict: (conflictId: string, resolution: ConflictResolution, resolvedBy: string, reason: string) => void
  submitRiskReview: (recordId: string, reviewer: string, opinion: RiskOpinion, comment: string) => void
  updateSummary: () => void
  setStep: (step: WorkflowStep) => void
  resetToSample: () => void
  loadScenario: (scenario: 'normal' | 'wrong-caliber' | 'supplement') => void
}

let idCounter = 100
const nextId = (prefix: string) => `${prefix}-${String(++idCounter).padStart(3, '0')}`

export const useStore = create<AppState>((set, get) => ({
  records: initialRecords,
  conflicts: initialConflicts,
  audits: initialAudits,
  riskReviews: initialRiskReviews,
  summaries: initialSummaries,
  currentStep: 2,

  importHolidayData: (incoming) => {
    const newRecords: TrialRecord[] = incoming.map((r) => {
      const status: TrialRecord['status'] = r.amount === 0 && r.remark === '已冲正' ? '待风控复核' : '正常'
      return {
        ...r,
        id: nextId('rec'),
        status,
        createdAt: now(),
        updatedAt: now(),
      }
    })
    const newAudits: AuditRecord[] = newRecords.map((r) => ({
      id: nextId('aud'),
      recordId: r.id,
      operator: '系统',
      action: '导入' as const,
      detail: `节假日顺延说明导入：${r.name}，金额 ${r.amount.toLocaleString()}${r.remark ? `，备注"${r.remark}"` : ''}`,
      reason: '节假日顺延说明首次导入',
      impactResult: `新增${r.status}记录`,
      operatedAt: now(),
    }))
    set((s) => ({
      records: [...s.records, ...newRecords],
      audits: [...s.audits, ...newAudits],
      currentStep: 1 as WorkflowStep,
    }))
  },

  supplementAdjustment: (incoming) => {
    const record: TrialRecord = {
      ...incoming,
      id: nextId('rec'),
      status: '尾差补录',
      createdAt: now(),
      updatedAt: now(),
    }
    const audit: AuditRecord = {
      id: nextId('aud'),
      recordId: record.id,
      operator: '阿芬',
      action: '补录',
      detail: `尾差调整条补录：${record.name}，金额 ${record.amount.toLocaleString()}，${record.caliber}`,
      reason: '对账运营阿芬补看尾差调整条',
      impactResult: '新增尾差补录记录',
      operatedAt: now(),
    }

    const existingNormal = get().records.find(
      (r) => r.name === record.name && r.source === '顺延说明'
    )
    let newConflicts: ConflictRecord[] = []
    if (existingNormal && existingNormal.amount !== record.amount) {
      newConflicts.push({
        id: nextId('conf'),
        recordId: record.id,
        holidayEvidence: `节假日顺延说明中该笔金额为 ${existingNormal.amount.toLocaleString()}，按${existingNormal.caliber}已结清`,
        adjustmentEvidence: `尾差调整条显示该笔尚有 ${record.amount.toLocaleString()} 元差额，${record.caliber}未结清`,
        conflictField: '金额',
        resolution: '待裁决',
        resolvedBy: '',
        resolvedAt: '',
        resolveReason: '',
      })
      audit.impactResult = '新增尾差补录记录，触发冲突检测'
    }

    set((s) => ({
      records: [...s.records, record],
      audits: [...s.audits, audit, ...newConflicts.map((c) => ({
        id: nextId('aud'),
        recordId: record.id,
        operator: '系统',
        action: '补录' as const,
        detail: `检测到冲突：${c.conflictField}字段，顺延说明 ${c.holidayEvidence} vs 尾差调整条 ${c.adjustmentEvidence}`,
        reason: '系统自动检测双源冲突',
        impactResult: '新增冲突记录，等待对账运营裁决',
        operatedAt: now(),
      }))],
      conflicts: [...s.conflicts, ...newConflicts],
      currentStep: 2 as WorkflowStep,
    }))
  },

  resolveConflict: (conflictId, resolution, resolvedBy, reason) => {
    set((s) => {
      const conflict = s.conflicts.find((c) => c.id === conflictId)
      if (!conflict) return s

      const updatedConflicts = s.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolution, resolvedBy, resolvedAt: now(), resolveReason: reason }
          : c
      )

      const recordUpdate =
        resolution === '已确认'
          ? { status: '尾差补录' as const, source: '尾差调整条' as const }
          : {}

      const updatedRecords = s.records.map((r) =>
        r.id === conflict.recordId ? { ...r, ...recordUpdate, updatedAt: now() } : r
      )

      const audit: AuditRecord = {
        id: nextId('aud'),
        recordId: conflict.recordId,
        operator: resolvedBy,
        action: resolution === '已确认' ? '确认冲突' : '驳回冲突',
        detail: `${resolvedBy}${resolution === '已确认' ? '确认' : '驳回'}了冲突：${conflict.conflictField}字段。理由：${reason}`,
        reason,
        impactResult: resolution === '已确认' ? '采纳尾差调整条数据' : '保留原始顺延说明数据',
        operatedAt: now(),
      }

      return {
        conflicts: updatedConflicts,
        records: updatedRecords,
        audits: [...s.audits, audit],
      }
    })
  },

  submitRiskReview: (recordId, reviewer, opinion, comment) => {
    const review: RiskReview = {
      id: nextId('rsk'),
      recordId,
      reviewer,
      opinion,
      comment,
      reviewedAt: now(),
    }
    const audit: AuditRecord = {
      id: nextId('aud'),
      recordId,
      operator: reviewer,
      action: '风控复核',
      detail: `风控复核：${reviewer}给出意见"${opinion}"，评语：${comment}`,
      reason: comment,
      impactResult: opinion === '通过' ? '已冲正记录确认，更新为正常' : opinion === '驳回' ? '已冲正记录驳回，保持待风控复核' : '待补充材料',
      operatedAt: now(),
    }

    set((s) => {
      const updatedRecords = s.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status: opinion === '通过' ? '正常' as const : r.status,
              updatedAt: now(),
            }
          : r
      )
      return {
        riskReviews: [...s.riskReviews, review],
        audits: [...s.audits, audit],
        records: updatedRecords,
      }
    })
  },

  updateSummary: () => {
    const { records, conflicts } = get()
    const summary: SummarySnapshot = {
      id: nextId('sum'),
      totalAmount: records.reduce((s, r) => s + r.amount, 0),
      normalCount: records.filter((r) => r.status === '正常').length,
      reversedCount: records.filter((r) => r.status === '已冲正' || r.status === '待风控复核').length,
      supplementCount: records.filter((r) => r.status === '尾差补录').length,
      riskReviewCount: records.filter((r) => r.status === '待风控复核').length,
      conflictCount: conflicts.length,
      resolvedConflictCount: conflicts.filter((c) => c.resolution !== '待裁决').length,
      createdAt: now(),
    }
    set((s) => ({
      summaries: [...s.summaries, summary],
      currentStep: 3 as WorkflowStep,
    }))
  },

  setStep: (step) => set({ currentStep: step }),

  resetToSample: () =>
    set({
      records: initialRecords,
      conflicts: initialConflicts,
      audits: initialAudits,
      riskReviews: initialRiskReviews,
      summaries: initialSummaries,
      currentStep: 2,
    }),

  loadScenario: (scenario) => {
    const baseTime = '2024-12-20T09:00:00Z'
    switch (scenario) {
      case 'normal':
        set({
          records: [
            {
              id: 'rec-001',
              name: '2024-Q4 利息收入-A档',
              amount: 1250000,
              status: '正常',
              remark: '',
              source: '顺延说明',
              caliber: '新口径',
              createdAt: baseTime,
              updatedAt: baseTime,
            },
          ],
          conflicts: [],
          audits: [
            {
              id: 'aud-001',
              recordId: 'rec-001',
              operator: '系统',
              action: '导入',
              detail: '节假日顺延说明导入：2024-Q4 利息收入-A档，金额 1,250,000',
              reason: '正常材料首次导入',
              impactResult: '新增正常记录',
              operatedAt: baseTime,
            },
          ],
          riskReviews: [],
          summaries: [],
          currentStep: 1,
        })
        break
      case 'wrong-caliber':
        set({
          records: [
            {
              id: 'rec-101',
              name: '2024-Q4 利息收入-C档',
              amount: 500000,
              status: '正常',
              remark: '',
              source: '顺延说明',
              caliber: '新口径',
              createdAt: baseTime,
              updatedAt: baseTime,
            },
            {
              id: 'rec-102',
              name: '2024-Q4 利息收入-C档',
              amount: 480000,
              status: '尾差补录',
              remark: '旧口径补录',
              source: '尾差调整条',
              caliber: '旧口径',
              createdAt: '2024-12-21T10:00:00Z',
              updatedAt: '2024-12-21T10:00:00Z',
            },
          ],
          conflicts: [
            {
              id: 'conf-101',
              recordId: 'rec-102',
              holidayEvidence: '顺延说明：C档利息 500,000（新口径）',
              adjustmentEvidence: '尾差调整条：C档利息 480,000（旧口径），差额 20,000',
              conflictField: '金额/口径',
              resolution: '待裁决',
              resolvedBy: '',
              resolvedAt: '',
              resolveReason: '',
            },
          ],
          audits: [
            {
              id: 'aud-101',
              recordId: 'rec-101',
              operator: '系统',
              action: '导入',
              detail: '节假日顺延说明导入：C档利息 500,000（新口径）',
              reason: '错口径材料首次导入',
              impactResult: '新增正常记录',
              operatedAt: baseTime,
            },
            {
              id: 'aud-102',
              recordId: 'rec-102',
              operator: '阿芬',
              action: '补录',
              detail: '尾差调整条补录：C档利息 480,000（旧口径），与新口径差额 20,000',
              reason: '补看尾差调整条发现口径差异',
              impactResult: '新增尾差补录记录，触发冲突检测',
              operatedAt: '2024-12-21T10:00:00Z',
            },
          ],
          riskReviews: [],
          summaries: [],
          currentStep: 2,
        })
        break
      case 'supplement':
        set({
          records: [
            {
              id: 'rec-201',
              name: '2024-Q3 基础资产池尾差',
              amount: 3500,
              status: '尾差补录',
              remark: '补录材料',
              source: '尾差调整条',
              caliber: '旧口径',
              createdAt: baseTime,
              updatedAt: baseTime,
            },
          ],
          conflicts: [],
          audits: [
            {
              id: 'aud-201',
              recordId: 'rec-201',
              operator: '阿芬',
              action: '补录',
              detail: '尾差调整条补录：基础资产池尾差 3,500（旧口径）',
              reason: '补录材料首次导入',
              impactResult: '新增尾差补录记录',
              operatedAt: baseTime,
            },
          ],
          riskReviews: [],
          summaries: [],
          currentStep: 2,
        })
        break
    }
  },
}))
