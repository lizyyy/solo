import { create } from 'zustand'
import type {
  TrustRecord,
  TaxRateRemark,
  CounterFlowTail,
  ConflictEvidence,
  AuditLog,
  UserRole,
} from '@/types'

const SMOOTH_RECORD: TrustRecord = {
  id: 'rec-001',
  productName: '信泰-稳健1号',
  recordType: 'smooth',
  status: 'smooth',
  taxRateRemark: {
    id: 'tax-001',
    recordId: 'rec-001',
    taxRate: 10,
    remark: '标准税费率，无特殊调整',
    sourceFile: '税费率备注_2024Q4.xlsx',
    importedAt: '2024-12-01 09:15:00',
    importedBy: '小周',
  },
  counterFlowTail: {
    id: 'cft-001',
    recordId: 'rec-001',
    tailNumber: '8847',
    oldStandardAmount: 12500000,
    currency: '人民币',
    supplementaryAt: '2024-12-02 14:30:00',
    supplementaryBy: '小周',
  },
  waterlineAmount: 12500000,
  currency: '人民币',
  rawCurrencyText: '人民币',
  hasMixedCurrency: false,
  hasConflict: false,
  currentStep: 3,
  createdAt: '2024-12-01 09:00:00',
  updatedAt: '2024-12-02 15:00:00',
}

const MIXED_CURRENCY_RECORD: TrustRecord = {
  id: 'rec-002',
  productName: '中融-海外优选',
  recordType: 'mixed_currency',
  status: 'pending_review',
  taxRateRemark: {
    id: 'tax-002',
    recordId: 'rec-002',
    taxRate: 12,
    remark: '含海外投资税费调整',
    sourceFile: '税费率备注_2024Q4.xlsx',
    importedAt: '2024-12-01 09:20:00',
    importedBy: '小周',
  },
  counterFlowTail: {
    id: 'cft-002',
    recordId: 'rec-002',
    tailNumber: '3356',
    oldStandardAmount: 8800000,
    currency: '港币/人民币',
    supplementaryAt: '2024-12-03 10:00:00',
    supplementaryBy: '小周',
  },
  waterlineAmount: 8800000,
  currency: '港币/人民币',
  rawCurrencyText: '港币/人民币',
  hasMixedCurrency: true,
  hasConflict: false,
  currentStep: 2,
  createdAt: '2024-12-01 09:00:00',
  updatedAt: '2024-12-03 10:00:00',
}

const SUPPLEMENTARY_RECORD: TrustRecord = {
  id: 'rec-003',
  productName: '华宝-经典系列',
  recordType: 'supplementary',
  status: 'pending_confirm',
  taxRateRemark: {
    id: 'tax-003',
    recordId: 'rec-003',
    taxRate: 15,
    remark: '旧口径税费率，柜台数据待核实',
    sourceFile: '税费率备注_2024Q3.xlsx',
    importedAt: '2024-11-15 11:00:00',
    importedBy: '小周',
  },
  counterFlowTail: {
    id: 'cft-003',
    recordId: 'rec-003',
    tailNumber: '6612',
    oldStandardAmount: 9500000,
    currency: '人民币',
    supplementaryAt: '2024-12-05 16:45:00',
    supplementaryBy: '小周',
  },
  waterlineAmount: 9500000,
  currency: '人民币',
  rawCurrencyText: '人民币',
  hasMixedCurrency: false,
  hasConflict: true,
  currentStep: 2,
  createdAt: '2024-11-15 10:30:00',
  updatedAt: '2024-12-05 16:45:00',
}

const INITIAL_CONFLICTS: ConflictEvidence[] = [
  {
    id: 'conflict-003',
    recordId: 'rec-003',
    taxRateRemarkValue: '15%',
    counterFlowTailValue: '12%',
    conflictField: '税费率',
    conflictDescription: '税费率备注中记录的税费率为15%，但柜台流水尾号6612对应的历史口径税费率为12%，两者不一致。请确认以哪个口径为准。',
    resolution: 'pending',
    resolvedBy: null,
    resolvedAt: null,
  },
]

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    recordId: 'rec-001',
    step: 'import_tax_rate',
    operator: '小周',
    role: '投研助理',
    timestamp: '2024-12-01 09:15:00',
    detail: '导入税费率备注：税费率10%，来源文件 税费率备注_2024Q4.xlsx',
    evidenceRef: 'tax-001',
  },
  {
    id: 'log-002',
    recordId: 'rec-001',
    step: 'supplementary_counter_flow',
    operator: '小周',
    role: '投研助理',
    timestamp: '2024-12-02 14:30:00',
    detail: '补看柜台流水尾号8847，旧口径金额12,500,000人民币，与税费率备注一致',
    evidenceRef: 'cft-001',
  },
  {
    id: 'log-003',
    recordId: 'rec-001',
    step: 'audit_update',
    operator: '系统',
    role: '系统',
    timestamp: '2024-12-02 15:00:00',
    detail: '审计明细更新完成，核算结果：顺利记录，无冲突',
    evidenceRef: 'rec-001',
  },
  {
    id: 'log-004',
    recordId: 'rec-002',
    step: 'import_tax_rate',
    operator: '小周',
    role: '投研助理',
    timestamp: '2024-12-01 09:20:00',
    detail: '导入税费率备注：税费率12%，来源文件 税费率备注_2024Q4.xlsx',
    evidenceRef: 'tax-002',
  },
  {
    id: 'log-005',
    recordId: 'rec-002',
    step: 'supplementary_counter_flow',
    operator: '小周',
    role: '投研助理',
    timestamp: '2024-12-03 10:00:00',
    detail: '补看柜台流水尾号3356，发现港币与人民币同列，标记待托管对接人复核',
    evidenceRef: 'cft-002',
  },
  {
    id: 'log-006',
    recordId: 'rec-003',
    step: 'import_tax_rate',
    operator: '小周',
    role: '投研助理',
    timestamp: '2024-11-15 11:00:00',
    detail: '导入税费率备注：税费率15%，来源文件 税费率备注_2024Q3.xlsx',
    evidenceRef: 'tax-003',
  },
  {
    id: 'log-007',
    recordId: 'rec-003',
    step: 'supplementary_counter_flow',
    operator: '小周',
    role: '投研助理',
    timestamp: '2024-12-05 16:45:00',
    detail: '补看柜台流水尾号6612，旧口径金额9,500,000人民币，发现税费率冲突（备注15% vs 柜台12%）',
    evidenceRef: 'cft-003',
  },
]

interface StoreState {
  records: TrustRecord[]
  conflicts: ConflictEvidence[]
  auditLogs: AuditLog[]
  currentRole: UserRole
  setCurrentRole: (role: UserRole) => void
  getRecord: (id: string) => TrustRecord | undefined
  importTaxRateRemark: (recordId: string, data: Omit<TaxRateRemark, 'id'>) => void
  supplementaryCounterFlow: (recordId: string, data: Omit<CounterFlowTail, 'id'>) => void
  resolveConflict: (conflictId: string, resolution: 'confirmed' | 'rejected', resolvedBy: string) => void
  reviewMixedCurrency: (recordId: string, passed: boolean) => void
  completeAudit: (recordId: string) => void
  getConflictsByRecord: (recordId: string) => ConflictEvidence[]
  getAuditLogsByRecord: (recordId: string) => AuditLog[]
}

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const useStore = create<StoreState>((set, get) => ({
  records: [SMOOTH_RECORD, MIXED_CURRENCY_RECORD, SUPPLEMENTARY_RECORD],
  conflicts: INITIAL_CONFLICTS,
  auditLogs: INITIAL_AUDIT_LOGS,
  currentRole: 'research_assistant',

  setCurrentRole: (role) => set({ currentRole: role }),

  getRecord: (id) => get().records.find((r) => r.id === id),

  importTaxRateRemark: (recordId, data) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? { ...r, taxRateRemark: { ...data, id: generateId() } as TaxRateRemark, currentStep: Math.max(r.currentStep, 1), updatedAt: new Date().toISOString() }
          : r
      ),
      auditLogs: [
        ...state.auditLogs,
        {
          id: generateId(),
          recordId,
          step: 'import_tax_rate' as const,
          operator: data.importedBy,
          role: '投研助理',
          timestamp: data.importedAt,
          detail: `导入税费率备注：税费率${data.taxRate}%，来源文件 ${data.sourceFile}`,
          evidenceRef: `tax-${recordId}`,
        },
      ],
    }))
  },

  supplementaryCounterFlow: (recordId, data) => {
    const record = get().records.find((r) => r.id === recordId)
    if (!record) return

    const hasMixed = data.currency.includes('/') || data.currency.includes('港币')
    const newConflict: ConflictEvidence | null = null

    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              counterFlowTail: { ...data, id: generateId() } as CounterFlowTail,
              hasMixedCurrency: hasMixed,
              rawCurrencyText: data.currency,
              currentStep: Math.max(r.currentStep, 2),
              status: hasMixed ? 'pending_review' : r.status,
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
      auditLogs: [
        ...state.auditLogs,
        {
          id: generateId(),
          recordId,
          step: 'supplementary_counter_flow' as const,
          operator: data.supplementaryBy,
          role: '投研助理',
          timestamp: data.supplementaryAt,
          detail: hasMixed
            ? `补看柜台流水尾号${data.tailNumber}，发现港币与人民币同列，标记待托管对接人复核`
            : `补看柜台流水尾号${data.tailNumber}，旧口径金额${data.oldStandardAmount.toLocaleString()}${data.currency}`,
          evidenceRef: `cft-${recordId}`,
        },
      ],
      ...(newConflict ? { conflicts: [...state.conflicts, newConflict] } : {}),
    }))
  },

  resolveConflict: (conflictId, resolution, resolvedBy) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolution, resolvedBy, resolvedAt: new Date().toISOString() }
          : c
      ),
      records: state.records.map((r) => {
        const conflict = state.conflicts.find((c) => c.id === conflictId)
        if (conflict && r.id === conflict.recordId) {
          return {
            ...r,
            hasConflict: false,
            status: resolution === 'confirmed' ? 'confirmed' : 'rejected',
            currentStep: Math.max(r.currentStep, 2),
            updatedAt: new Date().toISOString(),
          }
        }
        return r
      }),
      auditLogs: [
        ...state.auditLogs,
        {
          id: generateId(),
          recordId: state.conflicts.find((c) => c.id === conflictId)?.recordId || '',
          step: 'conflict_resolved' as const,
          operator: resolvedBy,
          role: '投研助理',
          timestamp: new Date().toISOString(),
          detail: resolution === 'confirmed'
            ? `冲突已确认：税费率以柜台流水尾号口径为准`
            : `冲突已驳回：税费率以税费率备注口径为准，需重新补录`,
          evidenceRef: conflictId,
        },
      ],
    }))
  },

  reviewMixedCurrency: (recordId, passed) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status: passed ? 'smooth' : 'rejected',
              hasMixedCurrency: false,
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
      auditLogs: [
        ...state.auditLogs,
        {
          id: generateId(),
          recordId,
          step: 'review_passed' as const,
          operator: '托管对接人',
          role: '托管对接人',
          timestamp: new Date().toISOString(),
          detail: passed
            ? '港币人民币同列记录复核通过'
            : '港币人民币同列记录复核不通过，退回投研助理修正',
          evidenceRef: recordId,
        },
      ],
    }))
  },

  completeAudit: (recordId) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? { ...r, status: 'completed', currentStep: 3, updatedAt: new Date().toISOString() }
          : r
      ),
      auditLogs: [
        ...state.auditLogs,
        {
          id: generateId(),
          recordId,
          step: 'audit_update' as const,
          operator: '系统',
          role: '系统',
          timestamp: new Date().toISOString(),
          detail: '审计明细更新完成，核算流程结束',
          evidenceRef: recordId,
        },
      ],
    }))
  },

  getConflictsByRecord: (recordId) => get().conflicts.filter((c) => c.recordId === recordId),

  getAuditLogsByRecord: (recordId) =>
    get()
      .auditLogs.filter((l) => l.recordId === recordId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
}))
