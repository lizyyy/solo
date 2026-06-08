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
  ValueChange,
} from '@/types'

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function detectFormatType(fields: Record<string, string>): 'percent' | 'decimal' | 'mixed' {
  const all = Object.values(fields).join(' ')
  const hasPercent = /%/.test(all)
  const hasDecimal = /(^|[\s,])0?\.\d+/.test(all.replace(/[%]/g, ''))
  if (hasPercent && hasDecimal) return 'mixed'
  if (hasPercent) return 'percent'
  return 'decimal'
}

function parseVarAmount(val: string): { num: number; isPercent: boolean } {
  const trimmed = val.trim()
  if (/%/.test(trimmed)) {
    const n = parseFloat(trimmed.replace(/[%,]/g, ''))
    return { num: isNaN(n) ? 0 : n / 100, isPercent: true }
  }
  const n = parseFloat(trimmed.replace(/[,]/g, ''))
  return { num: isNaN(n) ? 0 : n, isPercent: false }
}

function displayVarAmount(num: number, isPercent: boolean): string {
  if (isPercent) return `${(num * 100).toFixed(2).replace(/\.?0+$/, '')}%`
  return num.toString()
}

function buildSuggestedValue(field: string, original: string): string | undefined {
  if (field === 'confidence' && /^0?\.\d+$/.test(original.trim())) {
    const n = parseFloat(original.trim())
    return `${Math.round(n * 100)}%`
  }
  if (field === 'varAmount') {
    const trimmed = original.trim()
    if (/^0?\.\d+$/.test(trimmed) && parseFloat(trimmed) < 1) {
      return `${(parseFloat(trimmed) * 100).toFixed(2).replace(/\.?0+$/, '')}%`
    }
  }
  return undefined
}

const NOW = Date.now()
const DAY = 86400000

function cloneFields(f: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(f))
}

function buildRow(fields: Record<string, string>, idx: number, batch: string, remark = ''): QuestionnaireRow {
  const fmt = detectFormatType(fields)
  const dup = false
  return {
    id: 'r' + Math.random().toString(36).slice(2, 8),
    rowIndex: idx,
    fields: cloneFields(fields),
    originalFields: cloneFields(fields),
    remark,
    importBatch: batch,
    importTime: NOW,
    formatType: fmt,
    needsReview: fmt === 'mixed' || dup,
    reviewOwner: fmt === 'mixed' ? '活动负责人' : undefined,
    reviewStatus: fmt === 'mixed' || dup ? 'pending' : 'released',
    valueChanges: [],
    recalcRequired: fmt === 'mixed' || dup,
  }
}

const BASE_ROWS: Array<{
  fields: Record<string, string>
  remark: string
  idx: number
  batch: string
  time: number
  owner?: string
}> = [
  {
    idx: 1,
    fields: { portfolio: '沪深300ETF', confidence: '95%', holdingPeriod: '1天', varAmount: '2.35%' },
    remark: '该组合波动率近期放大，注意尾部风险',
    batch: 'batch-001',
    time: NOW - DAY,
  },
  {
    idx: 2,
    fields: { portfolio: '中证500期货', confidence: '0.95', holdingPeriod: '1天', varAmount: '0.0312' },
    remark: '期货保证金占用需额外考虑',
    batch: 'batch-001',
    time: NOW - DAY,
  },
  {
    idx: 3,
    fields: { portfolio: '国债10Y', confidence: '99%', holdingPeriod: '10天', varAmount: '1.7' },
    remark: '久期偏长，利率敏感度高。边界值：纯小数=绝对金额(百万元)。需确认1.7是1.7%还是170万元',
    batch: 'batch-001',
    time: NOW - DAY,
    owner: '活动负责人',
  },
  {
    idx: 4,
    fields: { portfolio: '黄金T+D', confidence: '0.99', holdingPeriod: '1天', varAmount: '4.8%' },
    remark: '置信度小数填写，按边界值说明需转换为百分数表达',
    batch: 'batch-001',
    time: NOW - DAY,
    owner: '活动负责人',
  },
  {
    idx: 5,
    fields: { portfolio: '沪深300ETF', confidence: '95%', holdingPeriod: '1天', varAmount: '2.35%' },
    remark: '重复导入，请确认是否为更新数据。若为新版本，请备注版本号后覆盖旧记录',
    batch: 'batch-002',
    time: NOW - 3600000,
    owner: '唐老师',
  },
]

const MOCK_ROWS: QuestionnaireRow[] = BASE_ROWS.map((d) => {
  const r = buildRow(d.fields, d.idx, d.batch, d.remark)
  r.importTime = d.time
  if (d.owner) {
    r.reviewOwner = d.owner
    r.reviewStatus = 'pending'
    r.needsReview = true
  }
  return r
})

const MOCK_BOUNDARY_NOTES: BoundaryNote[] = [
  {
    id: 'bn1',
    fieldName: 'confidence',
    originalText:
      '置信度应为百分数表达，如95%、99%。部分问卷行以0.95小数填写，需统一为百分数后方可入表，但不得删除原始小数记录。转换示例：0.95→95%，0.99→99%。转换前必须先确认原填写人意图，确认值后保留原始说法备查。',
    relatedRowIds: ['r2', 'r4'].map((_, i) => MOCK_ROWS[i + 1]?.id || 'r2').filter((x) => x),
    appliedRowIds: [],
  },
  {
    id: 'bn2',
    fieldName: 'varAmount',
    originalText:
      'VaR金额若带%号，表示占组合净值比例；若为纯小数，表示绝对损失金额（单位：百万元）。二者不可混同计算，务必逐条核实。临界值：值<1的纯小数极可能是遗漏了%号，需回查原始问卷或咨询填写人。原始说法（原值、原格式）任何时候不得被系统静默清洗。',
    relatedRowIds: ['r3', 'r4'].map((_, i) => MOCK_ROWS[i + 2]?.id || 'r3').filter((x) => x),
    appliedRowIds: [],
  },
  {
    id: 'bn3',
    fieldName: 'holdingPeriod',
    originalText:
      '持有期统一为天数，最小1天。若出现"1周"等表述需折算为5天，但原始表述须保留在备注中。若出现小数天数（如0.5天）需回查填写人。',
    relatedRowIds: [],
    appliedRowIds: [],
  },
]

function initConflicts(rows: QuestionnaireRow[]): ConflictRecord[] {
  return [
    {
      id: 'c1',
      rowId: rows[2]?.id || 'r3',
      boundaryNoteId: 'bn2',
      field: 'varAmount',
      originalValue: '1.7',
      boundaryValue: '带%号=占比；纯小数=绝对金额（百万元）。值<1的纯小数需回查是否漏%',
      suggestedValue: buildSuggestedValue('varAmount', '1.7'),
      status: 'pending',
    },
    {
      id: 'c2',
      rowId: rows[3]?.id || 'r4',
      boundaryNoteId: 'bn1',
      field: 'confidence',
      originalValue: '0.99',
      boundaryValue: '置信度应为百分数表达，0.99需转换为99%，但原值不得删除',
      suggestedValue: buildSuggestedValue('confidence', '0.99'),
      status: 'pending',
    },
  ]
}

function initCalculations(rows: QuestionnaireRow[]): CalculationDetail[] {
  return rows.slice(0, 4).map((row, i) => {
    const varRaw = row.fields.varAmount
    const { num, isPercent } = parseVarAmount(varRaw)
    const display = displayVarAmount(num, isPercent)
    return {
      id: 'cd' + (i + 1),
      rowId: row.id,
      varValue: num,
      originalVarValue: num,
      displayFormat: isPercent ? 'percent' : 'decimal',
      displayValue: display,
      originalDisplayValue: display,
      lastUpdated: row.importTime,
      updatedBy: 'system',
      recalcVersion: 1,
      recalcSource: '首次导入',
      released: row.reviewStatus === 'released' && row.formatType !== 'mixed',
      versionHistory: [
        { version: 1, varValue: num, displayValue: display, updatedAt: row.importTime, updatedBy: 'system', source: '首次导入' },
      ],
    }
  })
}

function initAudits(rows: QuestionnaireRow[], calcs: CalculationDetail[]): AuditEntry[] {
  return rows.map((row, i) => ({
    id: 'a' + (i + 1),
    entityType: 'row',
    entityId: row.id,
    action: '导入',
    operator: '唐老师',
    timestamp: row.importTime,
    reason: `${row.remark ? row.remark.slice(0, 20) + '...' : '首次导入' + row.importBatch}`,
    affectedResults: calcs.filter((c) => c.rowId === row.id).map((c) => c.id),
  }))
}

const MOCK_CONFLICTS: ConflictRecord[] = initConflicts(MOCK_ROWS)
const MOCK_CALCULATIONS: CalculationDetail[] = initCalculations(MOCK_ROWS)
const MOCK_AUDITS: AuditEntry[] = initAudits(MOCK_ROWS, MOCK_CALCULATIONS)

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
  selectedRowId: string | null

  setCurrentStep: (step: StepStatus) => void
  setRows: (rows: QuestionnaireRow[]) => void
  addRows: (rows: QuestionnaireRow[]) => void
  setBoundaryNotes: (notes: BoundaryNote[]) => void
  setConflicts: (conflicts: ConflictRecord[]) => void

  applyFieldCorrection: (
    rowId: string,
    field: string,
    newValue: string,
    operator: string,
    reason: string,
    nextOwner?: string
  ) => void

  resolveConflict: (
    id: string,
    status: ConflictStatus,
    decidedBy: string,
    reason: string,
    resolvedValue?: string,
    applyToRow?: boolean
  ) => void

  recalculate: (rowId: string | 'all', operator: string, source: string) => void

  releaseCalculation: (calcId: string, operator: string) => void

  setCalculations: (calcs: CalculationDetail[]) => void
  addAudit: (entry: Omit<AuditEntry, 'id'>) => void
  runSelfCheck: () => SelfCheckResult
  exportPayload: () => {
    exportTime: string
    exportedBy: string
    rows: QuestionnaireRow[]
    boundaryNotes: BoundaryNote[]
    conflicts: ConflictRecord[]
    calculations: CalculationDetail[]
    audits: AuditEntry[]
    selfCheck: SelfCheckResult | null
  }
  setBoundaryDrawerOpen: (open: boolean) => void
  setSelectedConflictId: (id: string | null) => void
  setSelectedRowId: (id: string | null) => void
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
  selectedRowId: null,

  setCurrentStep: (step) => set({ currentStep: step }),
  setRows: (rows) => set({ rows }),

  addRows: (newRows) =>
    set((state) => {
      const existing = state.rows
      const enriched: QuestionnaireRow[] = newRows.map((row) => {
        const isDup = existing.some(
          (other) =>
            other.fields.portfolio === row.fields.portfolio &&
            other.fields.varAmount === row.fields.varAmount
        )
        return {
          ...row,
          needsReview: isDup || row.formatType === 'mixed',
          reviewStatus: isDup || row.formatType === 'mixed' ? 'pending' : 'released',
          reviewOwner:
            row.formatType === 'mixed'
              ? '活动负责人'
              : isDup
              ? '唐老师'
              : row.reviewOwner,
          recalcRequired: isDup || row.formatType === 'mixed',
        }
      })
      const allRows = [...existing, ...enriched]

      const freshCalcs: CalculationDetail[] = enriched.map((row) => {
        const { num, isPercent } = parseVarAmount(row.fields.varAmount)
        const display = displayVarAmount(num, isPercent)
        return {
          id: 'cd' + uid(),
          rowId: row.id,
          varValue: num,
          originalVarValue: num,
          displayFormat: isPercent ? 'percent' : 'decimal',
          displayValue: display,
          originalDisplayValue: display,
          lastUpdated: Date.now(),
          updatedBy: 'system',
          recalcVersion: 1,
          recalcSource: '导入',
          released: row.reviewStatus === 'released' && row.formatType !== 'mixed',
          versionHistory: [
            {
              version: 1,
              varValue: num,
              displayValue: display,
              updatedAt: Date.now(),
              updatedBy: 'system',
              source: '导入',
            },
          ],
        }
      })
      const freshAudits: AuditEntry[] = enriched.map((row) => ({
        id: uid(),
        entityType: 'row' as const,
        entityId: row.id,
        action: '导入',
        operator: '唐老师',
        timestamp: Date.now(),
        reason: row.remark || `导入 ${row.importBatch}`,
        affectedResults: freshCalcs.filter((c) => c.rowId === row.id).map((c) => c.id),
      }))
      return {
        rows: allRows,
        calculations: [...state.calculations, ...freshCalcs],
        audits: [...state.audits, ...freshAudits],
      }
    }),

  setBoundaryNotes: (notes) => set({ boundaryNotes: notes }),
  setConflicts: (conflicts) => set({ conflicts }),

  applyFieldCorrection: (rowId, field, newValue, operator, reason, nextOwner) =>
    set((state) => {
      const row = state.rows.find((r) => r.id === rowId)
      if (!row) return state
      const oldValue = row.fields[field] || ''
      if (oldValue === newValue) return state

      const change: ValueChange = {
        field,
        before: oldValue,
        after: newValue,
        reason,
        operator,
        timestamp: Date.now(),
        nextOwner,
      }

      const newFields = { ...row.fields, [field]: newValue }
      const fmt = detectFormatType(newFields)

      const updatedRow: QuestionnaireRow = {
        ...row,
        fields: newFields,
        formatType: fmt,
        valueChanges: [...row.valueChanges, change],
        recalcRequired: true,
        needsReview: fmt === 'mixed' || (nextOwner ? true : false),
        reviewOwner: nextOwner || row.reviewOwner,
        reviewStatus: nextOwner ? 'pending' : row.reviewStatus,
        lastRecalcAt: undefined,
      }

      const newRows = state.rows.map((r) => (r.id === rowId ? updatedRow : r))

      const fieldAudit: AuditEntry = {
        id: uid(),
        entityType: 'row',
        entityId: rowId,
        action: `修正${field}`,
        operator,
        timestamp: Date.now(),
        reason,
        affectedResults: state.calculations.filter((c) => c.rowId === rowId).map((c) => c.id),
        extra: { before: oldValue, after: newValue, field },
      }

      return {
        rows: newRows,
        audits: [...state.audits, fieldAudit],
      }
    }),

  resolveConflict: (
    id,
    status,
    decidedBy,
    reason,
    resolvedValue,
    applyToRow = true
  ) =>
    set((state) => {
      const conflict = state.conflicts.find((c) => c.id === id)
      if (!conflict) return state

      let updatedRows = state.rows
      let updatedCalcs = state.calculations
      const extraAudits: AuditEntry[] = []
      const finalResolved = resolvedValue || (status === 'confirmed' ? conflict.suggestedValue : undefined)

      if (status === 'confirmed' && finalResolved && applyToRow) {
        const target = updatedRows.find((r) => r.id === conflict.rowId)
        if (target && target.fields[conflict.field] !== finalResolved) {
          const oldVal = target.fields[conflict.field]
          const newFields = { ...target.fields, [conflict.field]: finalResolved }
          const fmt = detectFormatType(newFields)
          const change: ValueChange = {
            field: conflict.field,
            before: oldVal || '',
            after: finalResolved,
            reason,
            operator: decidedBy,
            timestamp: Date.now(),
            nextOwner:
              fmt === 'mixed' ? '活动负责人' : target.formatType !== fmt ? '活动负责人' : undefined,
          }
          updatedRows = updatedRows.map((r) =>
            r.id === conflict.rowId
              ? {
                  ...r,
                  fields: newFields,
                  originalFields: r.originalFields,
                  formatType: fmt,
                  valueChanges: [...r.valueChanges, change],
                  recalcRequired: true,
                  lastRecalcAt: undefined,
                  reviewOwner: change.nextOwner || r.reviewOwner,
                  reviewStatus: change.nextOwner ? 'pending' : r.reviewStatus,
                  needsReview: fmt === 'mixed' ? true : r.needsReview,
                }
              : r
          )
          extraAudits.push({
            id: uid(),
            entityType: 'row',
            entityId: conflict.rowId,
            action: `冲突裁决-修正${conflict.field}`,
            operator: decidedBy,
            timestamp: Date.now(),
            reason,
            affectedResults: updatedCalcs.filter((c) => c.rowId === conflict.rowId).map((c) => c.id),
            extra: { conflictId: id, before: oldVal, after: finalResolved, decision: 'confirmed' },
          })
        }
      }

      const updatedConflicts = state.conflicts.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              decidedBy,
              decidedAt: Date.now(),
              reason,
              resolvedValue: finalResolved,
              recalcTriggered: status === 'confirmed' && !!finalResolved,
              recalcFinished: false,
            }
          : c
      )

      if (status === 'confirmed' && finalResolved && applyToRow) {
        const row = updatedRows.find((r) => r.id === conflict.rowId)
        if (row) {
          const { num, isPercent } = parseVarAmount(row.fields.varAmount)
          const display = displayVarAmount(num, isPercent)
          updatedCalcs = updatedCalcs.map((c) => {
            if (c.rowId !== row.id) return c
            const nextVersion = c.recalcVersion + 1
            return {
              ...c,
              varValue: num,
              displayFormat: isPercent ? 'percent' : 'decimal',
              displayValue: display,
              lastUpdated: Date.now(),
              updatedBy: decidedBy,
              recalcVersion: nextVersion,
              recalcSource: `冲突裁决#${id}`,
              released: row.formatType !== 'mixed' ? c.released : false,
              versionHistory: [
                ...c.versionHistory,
                {
                  version: nextVersion,
                  varValue: num,
                  displayValue: display,
                  updatedAt: Date.now(),
                  updatedBy: decidedBy,
                  source: `冲突裁决#${id}`,
                },
              ],
            }
          })
          const targetRow = updatedRows.find((r) => r.id === row.id)
          if (targetRow) {
            updatedRows = updatedRows.map((r) =>
              r.id === row.id
                ? { ...r, lastRecalcAt: Date.now(), recalcRequired: r.formatType === 'mixed' }
                : r
            )
          }
          extraAudits.push({
            id: uid(),
            entityType: 'recalc',
            entityId: conflict.rowId,
            action: '冲突裁决后自动重算',
            operator: decidedBy,
            timestamp: Date.now(),
            reason: `冲突#${id}裁决为确认，已按边界值说明自动重算。原值(${conflict.originalValue})仍保存在originalFields。`,
            affectedResults: updatedCalcs.filter((c) => c.rowId === row.id).map((c) => c.id),
            extra: {
              conflictId: id,
              field: conflict.field,
              rowId: row.id,
              decision: status,
            },
          })
          updatedConflicts.forEach((c, i) => {
            if (c.id === id) updatedConflicts[i] = { ...c, recalcFinished: true }
          })
        }
      }

      const bn = state.boundaryNotes.find((n) => n.id === conflict.boundaryNoteId)
      const updatedNotes =
        status === 'confirmed' && bn && !bn.appliedRowIds.includes(conflict.rowId)
          ? state.boundaryNotes.map((n) =>
              n.id === bn.id
                ? { ...n, appliedRowIds: [...n.appliedRowIds, conflict.rowId] }
                : n
            )
          : state.boundaryNotes

      const conflictAudit: AuditEntry = {
        id: uid(),
        entityType: 'conflict',
        entityId: id,
        action: status === 'confirmed' ? '确认冲突' : '驳回冲突',
        operator: decidedBy,
        timestamp: Date.now(),
        reason,
        affectedResults: updatedCalcs.filter((c) => c.rowId === conflict.rowId).map((c) => c.id),
        extra: {
          decision: status,
          resolvedValue: finalResolved,
          field: conflict.field,
          rowId: conflict.rowId,
        },
      }

      return {
        rows: updatedRows,
        boundaryNotes: updatedNotes,
        conflicts: updatedConflicts,
        calculations: updatedCalcs,
        audits: [...state.audits, conflictAudit, ...extraAudits],
      }
    }),

  recalculate: (rowId, operator, source) =>
    set((state) => {
      const targetIds =
        rowId === 'all' ? state.rows.map((r) => r.id) : [rowId]
      if (targetIds.length === 0) return state

      const updatedRows = state.rows.map((r) =>
        targetIds.includes(r.id) ? { ...r, lastRecalcAt: Date.now(), recalcRequired: false } : r
      )

      const updatedCalcs = state.calculations.map((c) => {
        if (!targetIds.includes(c.rowId)) return c
        const row = updatedRows.find((r) => r.id === c.rowId)
        if (!row) return c
        const { num, isPercent } = parseVarAmount(row.fields.varAmount)
        const display = displayVarAmount(num, isPercent)
        const nextVersion = c.recalcVersion + 1
        return {
          ...c,
          varValue: num,
          displayFormat: isPercent ? ('percent' as const) : ('decimal' as const),
          displayValue: display,
          lastUpdated: Date.now(),
          updatedBy: operator,
          recalcVersion: nextVersion,
          recalcSource: source,
          released: row.formatType !== 'mixed' && !row.needsReview ? c.released : false,
          versionHistory: [
            ...c.versionHistory,
            {
              version: nextVersion,
              varValue: num,
              displayValue: display,
              updatedAt: Date.now(),
              updatedBy: operator,
              source,
            },
          ],
        }
      })

      const calcIds = updatedCalcs.filter((c) => targetIds.includes(c.rowId)).map((c) => c.id)
      const audit: AuditEntry = {
        id: uid(),
        entityType: 'recalc',
        entityId: rowId === 'all' ? 'all' : rowId,
        action: rowId === 'all' ? '全量重算' : `重算${rowId}`,
        operator,
        timestamp: Date.now(),
        reason: source,
        affectedResults: calcIds,
        extra: { recalcCount: calcIds.length },
      }

      return {
        rows: updatedRows,
        calculations: updatedCalcs,
        audits: [...state.audits, audit],
      }
    }),

  releaseCalculation: (calcId, operator) =>
    set((state) => {
      const calc = state.calculations.find((c) => c.id === calcId)
      if (!calc) return state
      const row = state.rows.find((r) => r.id === calc.rowId)
      if (row && (row.formatType === 'mixed' || row.needsReview)) {
        return state
      }

      const updatedCalcs = state.calculations.map((c) =>
        c.id === calcId
          ? {
              ...c,
              released: true,
              releasedBy: operator,
              releasedAt: Date.now(),
            }
          : c
      )
      const updatedRows = state.rows.map((r) =>
        r.id === calc.rowId
          ? { ...r, needsReview: false, reviewStatus: 'released' as const }
          : r
      )
      const audit: AuditEntry = {
        id: uid(),
        entityType: 'calculation',
        entityId: calcId,
        action: '释放发布',
        operator,
        timestamp: Date.now(),
        reason: `计算明细通过复核，正式发布`,
        affectedResults: [calcId],
        extra: { rowId: calc.rowId },
      }
      return {
        rows: updatedRows,
        calculations: updatedCalcs,
        audits: [...state.audits, audit],
      }
    }),

  setCalculations: (calcs) => set({ calculations: calcs }),

  addAudit: (entry) =>
    set((state) => ({
      audits: [...state.audits, { ...entry, id: uid() }],
    })),

  runSelfCheck: () => {
    const { rows, calculations, conflicts, boundaryNotes } = get()

    const duplicateKeys = new Map<string, string[]>()
    rows.forEach((r) => {
      const k = `${r.fields.portfolio}|${r.fields.varAmount}`
      const arr = duplicateKeys.get(k) || []
      arr.push(r.id)
      duplicateKeys.set(k, arr)
    })
    const dups = Array.from(duplicateKeys.entries()).filter(([, ids]) => ids.length > 1)
    const duplicateImport: CheckStatus = dups.length > 0 ? 'warning' : 'pass'

    const mixedRows = rows.filter((r) => r.formatType === 'mixed')
    const formatConsistency: CheckStatus = mixedRows.length > 0 ? 'fail' : 'pass'

    const pendingConflicts = conflicts.filter((c) => c.status === 'pending')
    const recalcUnfinished = conflicts.filter(
      (c) => c.status === 'confirmed' && c.recalcTriggered && !c.recalcFinished
    )
    const unrecalced = rows.filter((r) => r.recalcRequired && !r.lastRecalcAt)
    const recalcAfterSupplement: CheckStatus =
      pendingConflicts.length > 0 || recalcUnfinished.length > 0
        ? 'warning'
        : unrecalced.length > 0
        ? 'fail'
        : 'pass'

    const rowIds = new Set(rows.map((r) => r.id))
    const calcRowIds = new Set(calculations.map((c) => c.rowId))
    const noCalc = rows.filter((r) => !calcRowIds.has(r.id))
    const orphanCalc = calculations.filter((c) => !rowIds.has(c.rowId))
    const noRelease = calculations.filter((c) => !c.released).length
    const bnNotApplied = boundaryNotes.filter(
      (n) => n.relatedRowIds.length > 0 && n.appliedRowIds.length < n.relatedRowIds.length
    )
    const exportConsistency: CheckStatus =
      noCalc.length > 0 || orphanCalc.length > 0
        ? 'fail'
        : noRelease > 0 || bnNotApplied.length > 0
        ? 'warning'
        : 'pass'

    const result: SelfCheckResult = {
      duplicateImport,
      formatConsistency,
      recalcAfterSupplement,
      exportConsistency,
      details: {
        duplicateImport:
          dups.length > 0
            ? dups.map(
                ([k, ids]) =>
                  `组合(${k.split('|')[0]},${k.split('|')[1]}) 出现 ${ids.length} 次: ${ids.join(',')}`
              )
            : ['未检测到重复导入'],
        formatConsistency:
          mixedRows.length > 0
            ? mixedRows.map(
                (r) =>
                  `行${r.rowIndex}(${r.fields.portfolio})格式混搭,负责人=${r.reviewOwner || '未指派'},状态=${r.reviewStatus}`
              )
            : ['所有行格式一致'],
        recalcAfterSupplement:
          pendingConflicts.length + recalcUnfinished.length + unrecalced.length > 0
            ? [
                ...pendingConflicts.map((c) => `冲突#${c.id}待裁决`),
                ...recalcUnfinished.map((c) => `冲突#${c.id}已裁决但重算未完成`),
                ...unrecalced.map((r) => `行${r.rowIndex}(${r.fields.portfolio})需重算未执行`),
              ]
            : ['所有补录/裁决后均已重算'],
        exportConsistency:
          noCalc.length + orphanCalc.length + noRelease + bnNotApplied.length > 0
            ? [
                ...noCalc.map((r) => `行${r.rowIndex}(${r.fields.portfolio})无计算明细`),
                ...orphanCalc.map((c) => `明细${c.id}关联的行${c.rowId}不存在`),
                ...(noRelease > 0 ? [`${noRelease}条计算明细未发布`] : []),
                ...bnNotApplied.map(
                  (n) =>
                    `边界值说明#${n.id}(${n.fieldName})有${n.relatedRowIds.length - n.appliedRowIds.length}行未生效`
                ),
              ]
            : ['导出明细/页面/接口均来自同一份store,完全一致'],
      },
    }
    set({ selfCheck: result })
    return result
  },

  exportPayload: () => {
    const s = get()
    return {
      exportTime: new Date().toISOString(),
      exportedBy: '唐老师',
      rows: s.rows,
      boundaryNotes: s.boundaryNotes,
      conflicts: s.conflicts,
      calculations: s.calculations,
      audits: s.audits,
      selfCheck: s.selfCheck,
    }
  },

  setBoundaryDrawerOpen: (open) => set({ boundaryDrawerOpen: open }),
  setSelectedConflictId: (id) => set({ selectedConflictId: id }),
  setSelectedRowId: (id) => set({ selectedRowId: id }),

  resetAll: () =>
    set({
      currentStep: 'import',
      rows: MOCK_ROWS,
      boundaryNotes: MOCK_BOUNDARY_NOTES,
      conflicts: MOCK_CONFLICTS,
      calculations: MOCK_CALCULATIONS,
      audits: MOCK_AUDITS,
      selfCheck: null,
      boundaryDrawerOpen: false,
      selectedConflictId: null,
      selectedRowId: null,
    }),
}))
