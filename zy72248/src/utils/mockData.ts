import type { BillItem, ConflictEvidence, HistoryRecord, ImportBatch } from '@/types'

let _id = 0
const nid = () => `B${String(++_id).padStart(4, '0')}`

const TAX_REMARKS = ['6%', '9%', '13%', '3%', '0%', '免税', '6%已冲正', '9%已冲正']
const TAIL_NOS = ['8842', '3317', '0056', '7721', '5593', '6688', '1144', '2299']
const REMARKS = ['', '已冲正', '部分冲正', '手续费', '利息', '罚息', '', '', '退款', '调账']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateBillItems(): BillItem[] {
  const items: BillItem[] = []
  const statuses: BillItem['status'][] = [
    'normal', 'normal', 'normal', 'normal', 'normal',
    'wrong_caliber', 'wrong_caliber',
    'supplement', 'supplement', 'supplement',
    'conflict', 'conflict', 'conflict',
    'risk_review', 'risk_review',
  ]

  for (let i = 0; i < 30; i++) {
    const status = statuses[i] || 'normal'
    const materialType: BillItem['materialType'] =
      status === 'wrong_caliber' ? 'wrong_caliber' :
      status === 'supplement' ? 'supplement' : 'normal'

    const amount = status === 'risk_review' ? 0 : Math.round(Math.random() * 100000) / 100
    const remark = status === 'risk_review' ? '已冲正' : pick(REMARKS)
    const isZeroWithReversal = amount === 0 && remark === '已冲正'

    const taxRateRemark = pick(TAX_REMARKS)
    const counterTxnTailNo = pick(TAIL_NOS)
    const hasConflict = status === 'conflict'

    items.push({
      id: nid(),
      billNo: `PJ${String(2026001 + i).padStart(7, '0')}`,
      amount,
      taxRateRemark,
      counterTxnTailNo,
      remark,
      status: isZeroWithReversal && status !== 'risk_review' ? 'risk_review' : status,
      materialType,
      importBatch: `BATCH-001`,
      importTime: '2026-06-01 09:15:00',
      isZeroWithReversal,
      conflictResolved: !hasConflict,
      conflictResolution: hasConflict ? undefined : undefined,
      riskReviewStatus: status === 'risk_review' ? 'pending' : undefined,
      supplementStep: status === 'supplement' ? 1 : 0,
      summaryUpdated: status === 'normal',
    })
  }

  return items
}

function generateConflicts(items: BillItem[]): ConflictEvidence[] {
  const conflicts: ConflictEvidence[] = []
  const conflictItems = items.filter(it => it.status === 'conflict')
  for (const item of conflictItems) {
    conflicts.push({
      id: `CF-${item.id}`,
      billItemId: item.id,
      field: '税费率',
      taxRateValue: item.taxRateRemark,
      counterTxnValue: `${Math.floor(Math.random() * 15 + 1)}%`,
      resolved: false,
    })
  }
  return conflicts
}

function generateHistory(items: BillItem[]): HistoryRecord[] {
  const records: HistoryRecord[] = []
  for (const item of items) {
    records.push({
      id: `H-${item.id}-1`,
      billItemId: item.id,
      action: 'import',
      operator: '阿芬',
      timestamp: item.importTime,
      beforeSnapshot: '{}',
      afterSnapshot: JSON.stringify({ status: item.status, amount: item.amount }),
      detail: `导入票据 ${item.billNo}，材料类型：${item.materialType}`,
    })
    if (item.isZeroWithReversal) {
      records.push({
        id: `H-${item.id}-2`,
        billItemId: item.id,
        action: 'self_check',
        operator: '系统',
        timestamp: '2026-06-01 09:16:00',
        beforeSnapshot: '{}',
        afterSnapshot: JSON.stringify({ status: 'risk_review' }),
        detail: `自检发现金额为0且备注已冲正，自动转风控待复核`,
      })
    }
    if (item.status === 'supplement' && item.supplementStep >= 1) {
      records.push({
        id: `H-${item.id}-3`,
        billItemId: item.id,
        action: 'supplement_step',
        operator: '阿芬',
        timestamp: '2026-06-01 10:30:00',
        beforeSnapshot: JSON.stringify({ supplementStep: 0 }),
        afterSnapshot: JSON.stringify({ supplementStep: 1 }),
        detail: `完成步骤一：税费率备注导入`,
      })
    }
  }
  return records
}

export function generateMockData() {
  const items = generateBillItems()
  const conflicts = generateConflicts(items)
  const history = generateHistory(items)
  const batches: ImportBatch[] = [
    { id: 'BATCH-001', time: '2026-06-01 09:15:00', type: 'normal', count: 15 },
    { id: 'BATCH-002', time: '2026-06-01 09:20:00', type: 'wrong_caliber', count: 5 },
    { id: 'BATCH-003', time: '2026-06-01 09:25:00', type: 'supplement', count: 10 },
  ]
  return { items, conflicts, history, batches }
}
