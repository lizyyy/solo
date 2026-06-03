import { create } from 'zustand'
import type {
  QuestionnaireRow,
  BoundaryNote,
  ConflictRecord,
  CalculationDetail,
  AuditEntry,
  SelfCheckResult,
  StepStatus,
  ConflictStatus,
  CheckStatus,
} from '@/types'

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const MOCK_ROWS: QuestionnaireRow[] = [
  {
    id: 'r1',
    rowIndex: 1,
    fields: { portfolio: '沪深300ETF', confidence: '95%', holdingPeriod: '1天', varAmount: '2.35%' },
    remark: '该组合波动率近期放大，注意尾部风险',
    importBatch: 'batch-001',
    importTime: Date.now() - 86400000,
    formatType: 'percent',
    needsReview: false,
  },
  {
    id: 'r2',
    rowIndex: 2,
    fields: { portfolio: '中证500期货', confidence: '0.95', holdingPeriod: '1天', varAmount: '0.0312' },
    remark: '期货保证金占用需额外考虑',
    importBatch: 'batch-001',
    importTime: Date.now() - 86400000,
    formatType: 'decimal',
    needsReview: false,
  },
  {
    id: 'r3',
    rowIndex: 3,
    fields: { portfolio: '国债10Y', confidence: '99%', holdingPeriod: '10天', varAmount: '1.7' },
    remark: '久期偏长，利率敏感度高',
    importBatch: 'batch-001',
    importTime: Date.now() - 86400000,
    formatType: 'mixed',
    needsReview: true,
  },
  {
    id: 'r4',
    rowIndex: 4,
    fields: { portfolio: '黄金T+D', confidence: '0.99', holdingPeriod: '1天', varAmount: '4.8%' },
    remark: '',
    importBatch: 'batch-001',
    importTime: Date.now() - 86400000,
    formatType: 'mixed',
    needsReview: true,
  },
  {
    id: 'r5',
    rowIndex: 5,
    fields: { portfolio: '沪深300ETF', confidence: '95%', holdingPeriod: '1天', varAmount: '2.35%' },
    remark: '重复导入，请确认是否为更新数据',
    importBatch: 'batch-002',
    importTime: Date.now() - 3600000,
    formatType: 'percent',
    needsReview: true,
  },
]

const MOCK_BOUNDARY_NOTES: BoundaryNote[] = [
  {
    id: 'bn1',
    fieldName: 'confidence',
    originalText: '置信度应为百分数表达，如95%、99%。部分问卷行以0.95小数填写，需统一为百分数后方可入表，但不得删除原始小数记录。',
    relatedRowIds: ['r2', 'r4'],
  },
  {
    id: 'bn2',
    fieldName: 'varAmount',
    originalText: 'VaR金额若带%号，表示占组合净值比例；若为纯小数，表示绝对损失金额（单位：百万元）。二者不可混同计算，务必逐条核实。',
    relatedRowIds: ['r3', 'r4'],
  },
  {
    id: 'bn3',
    fieldName: 'holdingPeriod',
    originalText: '持有期统一为天数，最小1天。若出现"1周"等表述需折算为5天，但原始表述须保留在备注中。',
    relatedRowIds: [],
  },
]

const MOCK_CONFLICTS: ConflictRecord[] = [
  {
    id: 'c1',
    rowId: 'r3',
    boundaryNoteId: 'bn2',
    field: 'varAmount',
    originalValue: '1.7',
    boundaryValue: '带%号=占比；纯小数=绝对金额（百万元）',
    status: 'pending',
  },
  {
    id: 'c2',
    rowId: 'r4',
    boundaryNoteId: 'bn1',
    field: 'confidence',
    originalValue: '0.99',
    boundaryValue: '置信度应为百分数表达',
    status: 'pending',
  },
]

const MOCK_CALCULATIONS: CalculationDetail[] = [
  { id: 'cd1', rowId: 'r1', varValue: 0.0235, displayFormat: 'percent', displayValue: '2.35%', lastUpdated: Date.now() - 86400000, updatedBy: 'system' },
  { id: 'cd2', rowId: 'r2', varValue: 0.0312, displayFormat: 'decimal', displayValue: '0.0312', lastUpdated: Date.now() - 86400000, updatedBy: 'system' },
  { id: 'cd3', rowId: 'r3', varValue: 1.7, displayFormat: 'decimal', displayValue: '1.7', lastUpdated: Date.now() - 86400000, updatedBy: 'system' },
  { id: 'cd4', rowId: 'r4', varValue: 0.048, displayFormat: 'percent', displayValue: '4.8%', lastUpdated: Date.now() - 86400000, updatedBy: 'system' },
]

const MOCK_AUDITS: AuditEntry[] = [
  { id: 'a1', entityType: 'row', entityId: 'r1', action: '导入', operator: '唐老师', timestamp: Date.now() - 86400000, reason: '首次导入batch-001', affectedResults: ['cd1'] },
  { id: 'a2', entityType: 'row', entityId: 'r2', action: '导入', operator: '唐老师', timestamp: Date.now() - 86400000, reason: '首次导入batch-001', affectedResults: ['cd2'] },
  { id: 'a3', entityType: 'row', entityId: 'r3', action: '导入', operator: '唐老师', timestamp: Date.now() - 86400000, reason: '首次导入batch-001，varAmount格式待复核', affectedResults: ['cd3'] },
  { id: 'a4', entityType: 'row', entityId: 'r5', action: '导入（重复）', operator: '唐老师', timestamp: Date.now() - 3600000, reason: '重复导入沪深300ETF，与r1可能重复', affectedResults: [] },
]

interface VarStore {
  currentStep: StepStatus
  rows: QuestionnaireRow[]
  boundaryNotes: BoundaryNote[]
  conflicts: ConflictRecord[]
  calculations: CalculationDetail[]
  audits: AuditEntry[]
  selfCheck: SelfCheckResult | null
  boundaryDrawerOpen: boolean
  selectedConflictId: string | null

  setCurrentStep: (step: StepStatus) => void
  setRows: (rows: QuestionnaireRow[]) => void
  addRows: (rows: QuestionnaireRow[]) => void
  setBoundaryNotes: (notes: BoundaryNote[]) => void
  setConflicts: (conflicts: ConflictRecord[]) => void
  resolveConflict: (id: string, status: ConflictStatus, decidedBy: string, reason: string) => void
  setCalculations: (calcs: CalculationDetail[]) => void
  addAudit: (entry: Omit<AuditEntry, 'id'>) => void
  runSelfCheck: () => SelfCheckResult
  setBoundaryDrawerOpen: (open: boolean) => void
  setSelectedConflictId: (id: string | null) => void
  resetAll: () => void
}

export const useVarStore = create<VarStore>((set, get) => ({
  currentStep: 'import',
  rows: MOCK_ROWS,
  boundaryNotes: MOCK_BOUNDARY_NOTES,
  conflicts: MOCK_CONFLICTS,
  calculations: MOCK_CALCULATIONS,
  audits: MOCK_AUDITS,
  selfCheck: null,
  boundaryDrawerOpen: false,
  selectedConflictId: null,

  setCurrentStep: (step) => set({ currentStep: step }),

  setRows: (rows) => set({ rows }),

  addRows: (newRows) =>
    set((state) => {
      const allRows = [...state.rows, ...newRows]
      const duplicateChecks = allRows.map((row) => {
        const isDup = allRows.some(
          (other) =>
            other.id !== row.id &&
            other.fields.portfolio === row.fields.portfolio &&
            other.fields.varAmount === row.fields.varAmount
        )
        return { ...row, needsReview: isDup || row.formatType === 'mixed' }
      })
      return { rows: duplicateChecks }
    }),

  setBoundaryNotes: (notes) => set({ boundaryNotes: notes }),

  setConflicts: (conflicts) => set({ conflicts }),

  resolveConflict: (id, status, decidedBy, reason) =>
    set((state) => {
      const updated = state.conflicts.map((c) =>
        c.id === id ? { ...c, status, decidedBy, decidedAt: Date.now(), reason } : c
      )
      const entry: AuditEntry = {
        id: uid(),
        entityType: 'conflict',
        entityId: id,
        action: status === 'confirmed' ? '确认冲突' : '驳回冲突',
        operator: decidedBy,
        timestamp: Date.now(),
        reason,
        affectedResults: updated
          .filter((c) => c.id === id)
          .flatMap((c) => state.calculations.filter((cd) => cd.rowId === c.rowId).map((cd) => cd.id)),
      }
      return { conflicts: updated, audits: [...state.audits, entry] }
    }),

  setCalculations: (calcs) => set({ calculations: calcs }),

  addAudit: (entry) =>
    set((state) => ({
      audits: [...state.audits, { ...entry, id: uid() }],
    })),

  runSelfCheck: () => {
    const { rows, calculations, conflicts } = get()

    const duplicateBatch = new Set<string>()
    const seen = new Map<string, string>()
    rows.forEach((r) => {
      const key = `${r.fields.portfolio}|${r.fields.varAmount}`
      if (seen.has(key)) duplicateBatch.add(r.importBatch)
      else seen.set(key, r.id)
    })
    const duplicateImport: CheckStatus = duplicateBatch.size > 0 ? 'warning' : 'pass'

    const mixedFormatRows = rows.filter((r) => r.formatType === 'mixed')
    const formatConsistency: CheckStatus = mixedFormatRows.length > 0 ? 'fail' : 'pass'

    const pendingConflicts = conflicts.filter((c) => c.status === 'pending')
    const recalcAfterSupplement: CheckStatus = pendingConflicts.length > 0 ? 'warning' : 'pass'

    const calcRowIds = new Set(calculations.map((c) => c.rowId))
    const rowIds = new Set(rows.map((r) => r.id))
    const allCovered = rows.every((r) => calcRowIds.has(r.id))
    const allReferenced = calculations.every((c) => rowIds.has(c.rowId))
    const exportConsistency: CheckStatus = allCovered && allReferenced ? 'pass' : 'fail'

    const result: SelfCheckResult = {
      duplicateImport,
      formatConsistency,
      recalcAfterSupplement,
      exportConsistency,
      details: {
        duplicateImport:
          duplicateBatch.size > 0
            ? [`发现重复批次: ${Array.from(duplicateBatch).join(', ')}`]
            : ['未检测到重复导入'],
        formatConsistency:
          mixedFormatRows.length > 0
            ? mixedFormatRows.map((r) => `行${r.rowIndex}(${r.fields.portfolio})存在百分数/小数混搭`)
            : ['所有行格式一致'],
        recalcAfterSupplement:
          pendingConflicts.length > 0
            ? pendingConflicts.map((c) => `冲突${c.id}尚未裁决`)
            : ['所有冲突已裁决，补录后重算完成'],
        exportConsistency:
          allCovered && allReferenced
            ? ['导出明细、页面展示、接口返回数据一致']
            : ['计算明细与问卷行不完全对应'],
      },
    }
    set({ selfCheck: result })
    return result
  },

  setBoundaryDrawerOpen: (open) => set({ boundaryDrawerOpen: open }),
  setSelectedConflictId: (id) => set({ selectedConflictId: id }),

  resetAll: () =>
    set({
      currentStep: 'import',
      rows: [],
      boundaryNotes: [],
      conflicts: [],
      calculations: [],
      audits: [],
      selfCheck: null,
      boundaryDrawerOpen: false,
      selectedConflictId: null,
    }),
}))
