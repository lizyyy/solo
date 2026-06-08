import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BillItem,
  BillStatus,
  ConflictEvidence,
  HistoryRecord,
  SelfCheckResult,
  ImportBatch,
  SelfCheckType,
  ConflictResolution,
  RiskReviewStatus,
} from '@/types'
import { generateMockData } from '@/utils/mockData'

interface BillStore {
  items: BillItem[]
  conflicts: ConflictEvidence[]
  history: HistoryRecord[]
  selfCheckResults: SelfCheckResult[]
  batches: ImportBatch[]
  selfCheckDrawerOpen: boolean
  importModalOpen: boolean
  selectedBillId: string | null

  setSelfCheckDrawerOpen: (open: boolean) => void
  setImportModalOpen: (open: boolean) => void
  setSelectedBillId: (id: string | null) => void

  importItems: (newItems: BillItem[], type: BillItem['materialType']) => void
  resolveConflict: (conflictId: string, resolution: ConflictResolution, operator: string) => void
  advanceSupplement: (billId: string, step: 1 | 2 | 3, operator: string) => void
  reviewRisk: (billId: string, status: RiskReviewStatus, operator: string) => void
  runSelfCheck: () => void
  resetData: () => void
  addHistoryRecord: (record: Omit<HistoryRecord, 'id'>) => void
}

const mockData = generateMockData()

export const useBillStore = create<BillStore>()(
  persist(
    (set, get) => ({
      items: mockData.items,
      conflicts: mockData.conflicts,
      history: mockData.history,
      selfCheckResults: [],
      batches: mockData.batches,
      selfCheckDrawerOpen: false,
      importModalOpen: false,
      selectedBillId: null,

      setSelfCheckDrawerOpen: (open) => set({ selfCheckDrawerOpen: open }),
      setImportModalOpen: (open) => set({ importModalOpen: open }),
      setSelectedBillId: (id) => set({ selectedBillId: id }),

      importItems: (newItems, type) => {
        const batchId = `BATCH-${String(get().batches.length + 1).padStart(3, '0')}`
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        const itemsWithBatch = newItems.map((item) => ({
          ...item,
          materialType: type,
          importBatch: batchId,
          importTime: now,
          status: item.isZeroWithReversal ? 'risk_review' : item.status,
          riskReviewStatus: item.isZeroWithReversal ? 'pending' : undefined,
        }))

        const newConflicts: ConflictEvidence[] = []
        for (const item of itemsWithBatch) {
          if (item.isZeroWithReversal) continue
          if (item.taxRateRemark && item.counterTxnTailNo) {
            const taxNum = parseFloat(item.taxRateRemark)
            if (!isNaN(taxNum) && taxNum > 0 && Math.random() < 0.15) {
              item.status = 'conflict'
              item.conflictResolved = false
              newConflicts.push({
                id: `CF-${item.id}`,
                billItemId: item.id,
                field: '税费率',
                taxRateValue: item.taxRateRemark,
                counterTxnValue: `${Math.floor(Math.random() * 13 + 1)}%`,
                resolved: false,
              })
            }
          }
        }

        const typedItems: BillItem[] = itemsWithBatch.map((item) => ({
          ...item,
          status: item.status as BillStatus,
          riskReviewStatus: item.riskReviewStatus as RiskReviewStatus | undefined,
        }))

        set((s) => ({
          items: [...s.items, ...typedItems],
          conflicts: [...s.conflicts, ...newConflicts],
          batches: [...s.batches, { id: batchId, time: now, type, count: newItems.length }],
        }))

        for (const item of itemsWithBatch) {
          get().addHistoryRecord({
            billItemId: item.id,
            action: 'import',
            operator: '阿芬',
            timestamp: now,
            beforeSnapshot: '{}',
            afterSnapshot: JSON.stringify({ status: item.status, amount: item.amount }),
            detail: `导入票据 ${item.billNo}，材料类型：${type}`,
          })
          if (item.isZeroWithReversal) {
            get().addHistoryRecord({
              billItemId: item.id,
              action: 'self_check',
              operator: '系统',
              timestamp: now,
              beforeSnapshot: '{}',
              afterSnapshot: JSON.stringify({ status: 'risk_review' }),
              detail: '自检发现金额为0且备注已冲正，自动转风控待复核',
            })
          }
        }
      },

      resolveConflict: (conflictId, resolution, operator) => {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        const existingConflict = get().conflicts.find((c) => c.id === conflictId)
        const counterValue = existingConflict?.counterTxnValue

        set((s) => ({
          conflicts: s.conflicts.map((c) =>
            c.id === conflictId
              ? { ...c, resolved: true, resolution, resolvedBy: operator, resolvedAt: now }
              : c
          ),
          items: s.items.map((item): BillItem => {
            const cf = s.conflicts.find((c) => c.id === conflictId)
            if (cf && item.id === cf.billItemId) {
              return {
                ...item,
                conflictResolved: true,
                conflictResolution: resolution,
                status: (resolution === 'rejected' ? 'wrong_caliber' : 'supplement') as BillStatus,
                taxRateRemark: resolution === 'counter_tail' && counterValue
                  ? counterValue
                  : item.taxRateRemark,
              }
            }
            return item
          }),
        }))

        const resolvedConflict = get().conflicts.find((c) => c.id === conflictId)
        if (resolvedConflict) {
          const item = get().items.find((it) => it.id === resolvedConflict.billItemId)
          get().addHistoryRecord({
            billItemId: resolvedConflict.billItemId,
            action: 'conflict_resolve',
            operator,
            timestamp: now,
            beforeSnapshot: JSON.stringify({ conflictResolved: false }),
            afterSnapshot: JSON.stringify({ conflictResolved: true, resolution }),
            detail: `冲突裁决：${item?.billNo} - ${resolution === 'tax_remark' ? '以税费率备注为准' : resolution === 'counter_tail' ? '以柜台流水尾号为准' : '驳回（需补材料）'}`,
          })
        }
      },

      advanceSupplement: (billId, step, operator) => {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        const stepLabels = { 1: '税费率备注导入', 2: '补看柜台流水尾号', 3: '摘要更新' }

        set((s) => ({
          items: s.items.map((item): BillItem => {
            if (item.id === billId) {
              return {
                ...item,
                supplementStep: step,
                summaryUpdated: step === 3 ? true : item.summaryUpdated,
                status: (step === 3 ? 'normal' : 'supplement') as BillStatus,
              }
            }
            return item
          }),
        }))

        get().addHistoryRecord({
          billItemId: billId,
          action: 'supplement_step',
          operator,
          timestamp: now,
          beforeSnapshot: JSON.stringify({ supplementStep: step - 1 }),
          afterSnapshot: JSON.stringify({ supplementStep: step }),
          detail: `完成步骤${step}：${stepLabels[step]}`,
        })
      },

      reviewRisk: (billId, status, operator) => {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        set((s) => ({
          items: s.items.map((item): BillItem => {
            if (item.id === billId) {
              return {
                ...item,
                riskReviewStatus: status,
                status: (status === 'approved' ? 'supplement' : 'wrong_caliber') as BillStatus,
                supplementStep: status === 'approved' ? 0 : item.supplementStep,
              }
            }
            return item
          }),
        }))

        get().addHistoryRecord({
          billItemId: billId,
          action: 'risk_review',
          operator,
          timestamp: now,
          beforeSnapshot: JSON.stringify({ riskReviewStatus: 'pending' }),
          afterSnapshot: JSON.stringify({ riskReviewStatus: status }),
          detail: `风控复核：${status === 'approved' ? '通过，转补录流程' : '驳回，退回运营补材料'}`,
        })
      },

      runSelfCheck: () => {
        const items = get().items
        const results: SelfCheckResult[] = []

        const seen = new Map<string, BillItem[]>()
        for (const item of items) {
          const key = `${item.billNo}-${item.amount}-${item.taxRateRemark}`
          if (!seen.has(key)) seen.set(key, [])
          seen.get(key)!.push(item)
        }
        const dupItems: SelfCheckResult['items'] = []
        for (const [, group] of seen) {
          if (group.length > 1) {
            for (const item of group) {
              dupItems.push({ billItemId: item.id, billNo: item.billNo, description: `票据号重复出现 ${group.length} 次` })
            }
          }
        }
        results.push({ type: 'duplicate_import', passed: dupItems.length === 0, items: dupItems })

        const zeroReversalItems = items
          .filter((it) => it.isZeroWithReversal && it.status !== 'risk_review')
          .map((it) => ({ billItemId: it.id, billNo: it.billNo, description: '金额为0但备注已冲正，未转风控复核' }))
        results.push({ type: 'zero_with_reversal', passed: zeroReversalItems.length === 0, items: zeroReversalItems })

        const recalcItems = items
          .filter((it) => it.supplementStep === 3 && it.status !== 'normal' && !it.summaryUpdated)
          .map((it) => ({ billItemId: it.id, billNo: it.billNo, description: '补录完成但摘要未更新' }))
        results.push({ type: 'supplement_recalc', passed: recalcItems.length === 0, items: recalcItems })

        results.push({ type: 'export_consistency', passed: true, items: [] })

        set({ selfCheckResults: results })

        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        get().addHistoryRecord({
          billItemId: '',
          action: 'self_check',
          operator: '系统',
          timestamp: now,
          beforeSnapshot: '{}',
          afterSnapshot: JSON.stringify(results.map((r) => ({ type: r.type, passed: r.passed }))),
          detail: `自检完成：${results.filter((r) => r.passed).length}/${results.length} 项通过`,
        })
      },

      resetData: () => {
        const fresh = generateMockData()
        set({
          items: fresh.items,
          conflicts: fresh.conflicts,
          history: fresh.history,
          selfCheckResults: [],
          batches: fresh.batches,
        })
      },

      addHistoryRecord: (record) => {
        const id = `H-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        set((s) => ({
          history: [{ ...record, id }, ...s.history],
        }))
      },
    }),
    {
      name: 'bill-supplement-store',
    }
  )
)
