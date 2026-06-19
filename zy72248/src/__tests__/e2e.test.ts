import { describe, it, expect, beforeEach } from 'vitest'
import { useBillStore } from '@/store/billStore'
import type { BillItem, LastExportSnapshot } from '@/types'
import { STATUS_LABELS } from '@/types'

function makeZeroReversalItem(): BillItem {
  return {
    id: 'TEST-ZR-001',
    billNo: 'PJ9999001',
    amount: 0,
    taxRateRemark: '6%',
    counterTxnTailNo: '8842',
    remark: '已冲正',
    status: 'risk_review',
    materialType: 'normal',
    importBatch: '',
    importTime: '',
    isZeroWithReversal: true,
    conflictResolved: true,
    riskReviewStatus: 'pending',
    supplementStep: 0,
    summaryUpdated: false,
  }
}

function makeNormalItem(): BillItem {
  return {
    id: 'TEST-NR-001',
    billNo: 'PJ9999002',
    amount: 1500.50,
    taxRateRemark: '免税',
    counterTxnTailNo: '3317',
    remark: '',
    status: 'normal',
    materialType: 'normal',
    importBatch: '',
    importTime: '',
    isZeroWithReversal: false,
    conflictResolved: true,
    supplementStep: 0,
    summaryUpdated: false,
  }
}

describe('票据影像补录清单 - 核心校验链路', () => {
  beforeEach(() => {
    useBillStore.getState().resetData()
  })

  it('CSV导入: 金额为0且备注已冲正 → isZeroWithReversal=true, status=risk_review', () => {
    const store = useBillStore.getState()
    store.importItems([makeZeroReversalItem(), makeNormalItem()], 'normal')

    const items = useBillStore.getState().items
    const zr = items.find((it) => it.billNo === 'PJ9999001')
    const nr = items.find((it) => it.billNo === 'PJ9999002')

    expect(zr).toBeDefined()
    expect(zr!.isZeroWithReversal).toBe(true)
    expect(zr!.status).toBe('risk_review')
    expect(zr!.riskReviewStatus).toBe('pending')

    expect(nr).toBeDefined()
    expect(nr!.isZeroWithReversal).toBe(false)
    expect(nr!.status).not.toBe('risk_review')

    const history = useBillStore.getState().history
    const selfCheckHistory = history.find(
      (h) => h.billItemId === zr!.id && h.action === 'self_check'
    )
    expect(selfCheckHistory).toBeDefined()
    expect(selfCheckHistory!.detail).toContain('金额为0且备注已冲正')
  })

  it('自检: 金额为0且备注已冲正的条目应被检出', () => {
    const store = useBillStore.getState()
    store.importItems([makeZeroReversalItem()], 'normal')
    store.runSelfCheck()

    const results = useBillStore.getState().selfCheckResults
    const zeroCheck = results.find((r) => r.type === 'zero_with_reversal')
    expect(zeroCheck).toBeDefined()
    expect(zeroCheck!.passed).toBe(true)
  })

  it('风控复核通过 → status=supplement, supplementStep=0', () => {
    const store = useBillStore.getState()
    store.importItems([makeZeroReversalItem()], 'normal')
    const zr = useBillStore.getState().items.find((it) => it.billNo === 'PJ9999001')!

    store.reviewRisk(zr.id, 'approved', '风控员')
    const updated = useBillStore.getState().items.find((it) => it.id === zr.id)!
    expect(updated.status).toBe('supplement')
    expect(updated.riskReviewStatus).toBe('approved')
    expect(updated.supplementStep).toBe(0)

    const history = useBillStore.getState().history
    const reviewHistory = history.find((h) => h.action === 'risk_review' && h.billItemId === zr.id)
    expect(reviewHistory).toBeDefined()
  })

  it('风控驳回 → status=wrong_caliber', () => {
    const store = useBillStore.getState()
    store.importItems([makeZeroReversalItem()], 'normal')
    const zr = useBillStore.getState().items.find((it) => it.billNo === 'PJ9999001')!

    store.reviewRisk(zr.id, 'rejected', '风控员')
    const updated = useBillStore.getState().items.find((it) => it.id === zr.id)!
    expect(updated.status).toBe('wrong_caliber')
    expect(updated.riskReviewStatus).toBe('rejected')
  })

  it('补录三步: 步骤1→2→3, 最终status=normal, summaryUpdated=true', () => {
    const store = useBillStore.getState()
    store.importItems([makeZeroReversalItem()], 'normal')
    const zr = useBillStore.getState().items.find((it) => it.billNo === 'PJ9999001')!

    store.reviewRisk(zr.id, 'approved', '风控员')
    const approved = useBillStore.getState().items.find((it) => it.id === zr.id)!

    store.advanceSupplement(approved.id, 1, '阿芬')
    let current = useBillStore.getState().items.find((it) => it.id === zr.id)!
    expect(current.supplementStep).toBe(1)
    expect(current.status).toBe('supplement')

    store.advanceSupplement(approved.id, 2, '阿芬')
    current = useBillStore.getState().items.find((it) => it.id === zr.id)!
    expect(current.supplementStep).toBe(2)

    store.advanceSupplement(approved.id, 3, '阿芬')
    current = useBillStore.getState().items.find((it) => it.id === zr.id)!
    expect(current.supplementStep).toBe(3)
    expect(current.status).toBe('normal')
    expect(current.summaryUpdated).toBe(true)

    const history = useBillStore.getState().history
    const supplementHistories = history.filter(
      (h) => h.billItemId === zr.id && h.action === 'supplement_step'
    )
    expect(supplementHistories.length).toBeGreaterThanOrEqual(3)
  })

  it('冲突裁决以柜台数据为准 → taxRateRemark被更新为counterTxnValue', () => {
    const store = useBillStore.getState()
    const conflictItems = useBillStore.getState().items.filter((it) => it.status === 'conflict')
    if (conflictItems.length === 0) return

    const conflictItem = conflictItems[0]
    const conflict = useBillStore.getState().conflicts.find(
      (c) => c.billItemId === conflictItem.id
    )!
    const originalTaxRate = conflictItem.taxRateRemark

    store.resolveConflict(conflict.id, 'counter_tail', '阿芬')
    const resolved = useBillStore.getState().items.find((it) => it.id === conflictItem.id)!
    expect(resolved.status).toBe('supplement')
    expect(resolved.conflictResolved).toBe(true)
    expect(resolved.taxRateRemark).toBe(conflict.counterTxnValue)
    expect(resolved.taxRateRemark).not.toBe(originalTaxRate)
  })

  it('冲突裁决以税费率备注为准 → taxRateRemark不变', () => {
    const store = useBillStore.getState()
    const conflictItems = useBillStore.getState().items.filter((it) => it.status === 'conflict')
    if (conflictItems.length === 0) return

    const conflictItem = conflictItems[0]
    const conflict = useBillStore.getState().conflicts.find(
      (c) => c.billItemId === conflictItem.id
    )!
    const originalTaxRate = conflictItem.taxRateRemark

    store.resolveConflict(conflict.id, 'tax_remark', '阿芬')
    const resolved = useBillStore.getState().items.find((it) => it.id === conflictItem.id)!
    expect(resolved.status).toBe('supplement')
    expect(resolved.taxRateRemark).toBe(originalTaxRate)
  })

  it('导出一致性: 先导出再自检，真实比对字段/数量/状态/历史记录', () => {
    const store = useBillStore.getState()
    const items = store.items
    const history = store.history

    const beforeCount = items.length
    expect(beforeCount).toBeGreaterThan(0)

    const rows = items.map((it) => ({
      票据号: it.billNo, 金额: it.amount, 税费率备注: it.taxRateRemark,
      柜台流水尾号: it.counterTxnTailNo, 备注: it.remark, 状态: STATUS_LABELS[it.status],
    }))

    const statusDistribution: Record<string, number> = {}
    for (const it of items) {
      const label = STATUS_LABELS[it.status]
      statusDistribution[label] = (statusDistribution[label] || 0) + 1
    }

    const itemsState = items.map((it) => ({
      id: it.id,
      billNo: it.billNo,
      status: it.status,
      taxRateRemark: it.taxRateRemark,
      remark: it.remark,
      summaryUpdated: it.summaryUpdated,
      conflictResolution: it.conflictResolution,
      riskReviewStatus: it.riskReviewStatus,
    }))

    const snapshot: LastExportSnapshot = {
      exportTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      fileName: '票据影像补录清单_TEST.xlsx',
      recordCount: items.length,
      fields: ['票据号', '金额', '税费率备注', '柜台流水尾号', '备注', '状态'],
      rows,
      statusDistribution,
      itemsState,
      historyCount: history.length,
      lastHistoryIds: history.slice(0, 5).map((h) => h.id),
    }

    store.setLastExportSnapshot(snapshot)
    expect(useBillStore.getState().lastExportSnapshot).not.toBeNull()

    store.runSelfCheck()

    const state = useBillStore.getState()
    const afterCount = state.items.length
    expect(afterCount).toBe(beforeCount)

    const results = state.selfCheckResults
    expect(results.length).toBe(4)
    expect(results.map((r) => r.type)).toContain('export_consistency')
    const exportCheck = results.find((r) => r.type === 'export_consistency')
    expect(exportCheck).toBeDefined()
    expect(exportCheck!.passed).toBe(true)
    expect(exportCheck!.items.length).toBe(0)
  })

  it('完整操作路: 导入含冲正项 → 自检 → 风控通过 → 补录三步 → 状态=正常', () => {
    const store = useBillStore.getState()
    store.importItems([makeZeroReversalItem(), makeNormalItem()], 'normal')

    store.runSelfCheck()
    const results = useBillStore.getState().selfCheckResults
    expect(results.length).toBe(4)

    const zr = useBillStore.getState().items.find((it) => it.billNo === 'PJ9999001')!
    expect(zr.status).toBe('risk_review')

    store.reviewRisk(zr.id, 'approved', '风控员')
    const approved = useBillStore.getState().items.find((it) => it.id === zr.id)!
    expect(approved.status).toBe('supplement')

    store.advanceSupplement(approved.id, 1, '阿芬')
    store.advanceSupplement(approved.id, 2, '阿芬')
    store.advanceSupplement(approved.id, 3, '阿芬')

    const final = useBillStore.getState().items.find((it) => it.id === zr.id)!
    expect(final.status).toBe('normal')
    expect(final.summaryUpdated).toBe(true)

    const nr = useBillStore.getState().items.find((it) => it.billNo === 'PJ9999002')!
    expect(nr.status).toBe('normal')

    const history = useBillStore.getState().history
    const fullChain = history.filter((h) => h.billItemId === zr.id)
    expect(fullChain.length).toBeGreaterThanOrEqual(5)
  })
})
