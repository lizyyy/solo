import type {
  ReconciliationRecord,
  TimelineEvent,
  BrokerRateEvidence,
  AggregationConclusion,
  FeeRecalcDetail,
  CancelRollbackDetail,
} from './types'

const brokers = [
  { id: 'B001', name: '中信证券' },
  { id: 'B002', name: '华泰证券' },
  { id: 'B003', name: '国泰君安' },
  { id: 'B004', name: '招商证券' },
  { id: 'B005', name: '广发证券' },
]

const records: ReconciliationRecord[] = [
  {
    id: 'R001', brokerId: 'B001', brokerName: '中信证券', orderId: 'ORD-20260530-0001',
    matchingFee: 1250.00, tradeReportFee: 1250.00, diffAmount: 0,
    diffTypes: [], status: 'confirmed', market: 'SSE',
    createdAt: '2026-05-30T09:15:00', updatedAt: '2026-05-30T14:30:00',
  },
  {
    id: 'R002', brokerId: 'B001', brokerName: '中信证券', orderId: 'ORD-20260530-0002',
    matchingFee: 890.50, tradeReportFee: 0, diffAmount: 890.50,
    diffTypes: ['cancellation_fee'], status: 'pending', market: 'SZSE',
    createdAt: '2026-05-30T09:22:00', updatedAt: '2026-05-30T09:22:00',
    aggregationConclusion: {
      recordId: 'R002', conclusionAmount: 890.50,
      logicDescription: '订单撤销后撮合费已产生，按规则撤单仍计费，结论金额 = 撮合费',
      corroboratedByRecalc: false, corroboratedByRollback: true,
    },
  },
  {
    id: 'R003', brokerId: 'B002', brokerName: '华泰证券', orderId: 'ORD-20260530-0003',
    matchingFee: 2100.00, tradeReportFee: 2100.00, diffAmount: 0,
    diffTypes: ['cross_market'], status: 'review', market: 'SSE',
    createdAt: '2026-05-30T09:30:00', updatedAt: '2026-05-30T15:00:00',
    aggregationConclusion: {
      recordId: 'R003', conclusionAmount: 0,
      logicDescription: '跨市场重复成交，上交所与深交所均有成交回报，经核实为同一笔交易，重复费用应扣减',
      corroboratedByRecalc: true, corroboratedByRollback: false,
    },
  },
  {
    id: 'R004', brokerId: 'B003', brokerName: '国泰君安', orderId: 'ORD-20260530-0004',
    matchingFee: 1560.00, tradeReportFee: 1480.00, diffAmount: 80.00,
    diffTypes: ['rate_version'], status: 'pending', market: 'BSE',
    createdAt: '2026-05-30T10:00:00', updatedAt: '2026-05-30T10:00:00',
    aggregationConclusion: {
      recordId: 'R004', conclusionAmount: 1480.00,
      logicDescription: '费率版本变更后按新费率重算，结论金额 = 成交回报费(新费率)',
      corroboratedByRecalc: true, corroboratedByRollback: false,
    },
  },
  {
    id: 'R005', brokerId: 'B004', brokerName: '招商证券', orderId: 'ORD-20260530-0005',
    matchingFee: 3200.00, tradeReportFee: 0, diffAmount: 3200.00,
    diffTypes: ['cancellation_fee', 'cross_market'], status: 'pending', market: 'SSE',
    createdAt: '2026-05-30T10:15:00', updatedAt: '2026-05-30T10:15:00',
    aggregationConclusion: {
      recordId: 'R005', conclusionAmount: 1600.00,
      logicDescription: '撤单仍计费 + 跨市场重复同时出现：先按撤单计费规则收取3200，再扣减跨市场重复部分1600，结论金额 = 1600',
      corroboratedByRecalc: true, corroboratedByRollback: true,
    },
  },
  {
    id: 'R006', brokerId: 'B002', brokerName: '华泰证券', orderId: 'ORD-20260530-0006',
    matchingFee: 780.00, tradeReportFee: 720.00, diffAmount: 60.00,
    diffTypes: ['rate_version', 'inconsistent'], status: 'pending', market: 'SZSE',
    createdAt: '2026-05-30T10:30:00', updatedAt: '2026-05-30T10:30:00',
    aggregationConclusion: {
      recordId: 'R006', conclusionAmount: 720.00,
      logicDescription: '费率版本错且晚到，撮合按旧费率780，成交回报按新费率720，经纪商费率确认为新费率，结论金额 = 720',
      corroboratedByRecalc: true, corroboratedByRollback: false,
    },
  },
  {
    id: 'R007', brokerId: 'B005', brokerName: '广发证券', orderId: 'ORD-20260530-0007',
    matchingFee: 4100.00, tradeReportFee: 0, diffAmount: 4100.00,
    diffTypes: ['cancellation_fee', 'cross_market', 'rate_version'], status: 'pending', market: 'SSE',
    createdAt: '2026-05-30T10:45:00', updatedAt: '2026-05-30T10:45:00',
    aggregationConclusion: {
      recordId: 'R007', conclusionAmount: 1950.00,
      logicDescription: '三重叠加：1)撤单仍计费产生4100 → 2)跨市场重复扣减2050 → 3)费率版本变更(新费率更低)再扣减100，结论金额 = 1950。事件顺序：撤单(10:46) → 跨市场标记(10:48) → 费率版本变更(10:52)',
      corroboratedByRecalc: true, corroboratedByRollback: true,
    },
  },
  {
    id: 'R008', brokerId: 'B001', brokerName: '中信证券', orderId: 'ORD-20260529-0008',
    matchingFee: 560.00, tradeReportFee: 560.00, diffAmount: 0,
    diffTypes: [], status: 'resolved', market: 'NEEQ',
    createdAt: '2026-05-29T14:00:00', updatedAt: '2026-05-29T16:30:00',
  },
  {
    id: 'R009', brokerId: 'B003', brokerName: '国泰君安', orderId: 'ORD-20260529-0009',
    matchingFee: 1800.00, tradeReportFee: 1650.00, diffAmount: 150.00,
    diffTypes: ['rate_version', 'inconsistent'], status: 'confirmed', market: 'SSE',
    createdAt: '2026-05-29T11:00:00', updatedAt: '2026-05-29T17:00:00',
    aggregationConclusion: {
      recordId: 'R009', conclusionAmount: 1650.00,
      logicDescription: '费率版本差异导致，经纪商费率确认新版本，结论金额 = 成交回报费',
      corroboratedByRecalc: true, corroboratedByRollback: false,
    },
  },
  {
    id: 'R010', brokerId: 'B004', brokerName: '招商证券', orderId: 'ORD-20260529-0010',
    matchingFee: 950.00, tradeReportFee: 950.00, diffAmount: 0,
    diffTypes: ['cross_market'], status: 'confirmed', market: 'SZSE',
    createdAt: '2026-05-29T13:20:00', updatedAt: '2026-05-30T09:00:00',
    aggregationConclusion: {
      recordId: 'R010', conclusionAmount: 0,
      logicDescription: '跨市场重复已核实扣减，结论金额 = 0(无差异)',
      corroboratedByRecalc: false, corroboratedByRollback: false,
    },
  },
  {
    id: 'R011', brokerId: 'B005', brokerName: '广发证券', orderId: 'ORD-20260530-0011',
    matchingFee: 620.00, tradeReportFee: 620.00, diffAmount: 0,
    diffTypes: [], status: 'pending', market: 'BSE',
    createdAt: '2026-05-30T11:00:00', updatedAt: '2026-05-30T11:00:00',
  },
  {
    id: 'R012', brokerId: 'B002', brokerName: '华泰证券', orderId: 'ORD-20260530-0012',
    matchingFee: 2400.00, tradeReportFee: 2200.00, diffAmount: 200.00,
    diffTypes: ['rate_version'], status: 'pending', market: 'SSE',
    createdAt: '2026-05-30T11:15:00', updatedAt: '2026-05-30T11:15:00',
  },
]

const timelineEvents: TimelineEvent[] = [
  { id: 'T001', recordId: 'R001', eventType: 'order_created', timestamp: '2026-05-30T09:15:00', description: '撮合订单 ORD-20260530-0001 创建，上交所，撮合费 ¥1,250.00', metadata: {} },
  { id: 'T002', recordId: 'R001', eventType: 'trade_report', timestamp: '2026-05-30T09:15:03', description: '成交回报确认，成交金额与撮合一致', metadata: {} },
  { id: 'T003', recordId: 'R001', eventType: 'conclusion', timestamp: '2026-05-30T14:30:00', description: '对账结论：一致，无差异', metadata: {} },

  { id: 'T004', recordId: 'R002', eventType: 'order_created', timestamp: '2026-05-30T09:22:00', description: '撮合订单 ORD-20260530-0002 创建，深交所，撮合费 ¥890.50', metadata: {} },
  { id: 'T005', recordId: 'R002', eventType: 'order_cancelled', timestamp: '2026-05-30T09:23:15', description: '订单撤销，但撮合费已产生，按规则撤单仍计费 ¥890.50', metadata: { feeAfterCancel: 890.50 } },
  { id: 'T006', recordId: 'R002', eventType: 'conclusion', timestamp: '2026-05-30T09:23:15', description: '对账结论：撤单仍计费，结论金额 ¥890.50', metadata: {} },

  { id: 'T007', recordId: 'R003', eventType: 'order_created', timestamp: '2026-05-30T09:30:00', description: '撮合订单 ORD-20260530-0003 创建，上交所，撮合费 ¥2,100.00', metadata: {} },
  { id: 'T008', recordId: 'R003', eventType: 'trade_report', timestamp: '2026-05-30T09:30:05', description: '成交回报确认，上交所成交 ¥2,100.00', metadata: {} },
  { id: 'T009', recordId: 'R003', eventType: 'cross_market_tag', timestamp: '2026-05-30T09:35:00', description: '标记为跨市场重复：深交所亦有成交回报 ¥2,100.00，需扣减重复部分', metadata: {} },
  { id: 'T010', recordId: 'R003', eventType: 'conclusion', timestamp: '2026-05-30T15:00:00', description: '对账结论：跨市场重复，扣减后结论金额 ¥0', metadata: {} },

  { id: 'T011', recordId: 'R004', eventType: 'order_created', timestamp: '2026-05-30T10:00:00', description: '撮合订单 ORD-20260530-0004 创建，北交所，撮合费 ¥1,560.00（旧费率）', metadata: {} },
  { id: 'T012', recordId: 'R004', eventType: 'trade_report', timestamp: '2026-05-30T10:00:05', description: '成交回报 ¥1,480.00（新费率）', metadata: {} },
  { id: 'T013', recordId: 'R004', eventType: 'rate_version_change', timestamp: '2026-05-30T10:05:00', description: '费率版本变更：v2.3 → v2.4，新费率低于旧费率，导致差异 ¥80.00', metadata: { oldVersion: 'v2.3', newVersion: 'v2.4' } },
  { id: 'T014', recordId: 'R004', eventType: 'conclusion', timestamp: '2026-05-30T10:05:00', description: '对账结论：费率版本变更，按新费率重算，结论金额 ¥1,480.00', metadata: {} },

  { id: 'T015', recordId: 'R005', eventType: 'order_created', timestamp: '2026-05-30T10:15:00', description: '撮合订单 ORD-20260530-0005 创建，上交所，撮合费 ¥3,200.00', metadata: {} },
  { id: 'T016', recordId: 'R005', eventType: 'order_cancelled', timestamp: '2026-05-30T10:16:00', description: '订单撤销，撤单仍计费 ¥3,200.00', metadata: { feeAfterCancel: 3200 } },
  { id: 'T017', recordId: 'R005', eventType: 'cross_market_tag', timestamp: '2026-05-30T10:18:00', description: '跨市场重复标记：深交所亦有成交，扣减 ¥1,600.00', metadata: {} },
  { id: 'T018', recordId: 'R005', eventType: 'conclusion', timestamp: '2026-05-30T10:18:00', description: '对账结论：撤单计费 + 跨市场重复，3200 - 1600 = ¥1,600.00', metadata: {} },

  { id: 'T019', recordId: 'R006', eventType: 'order_created', timestamp: '2026-05-30T10:30:00', description: '撮合订单 ORD-20260530-0006 创建，深交所，撮合费 ¥780.00（旧费率 v2.3）', metadata: {} },
  { id: 'T020', recordId: 'R006', eventType: 'trade_report', timestamp: '2026-05-30T10:30:05', description: '成交回报 ¥720.00（新费率 v2.4），与撮合结论不一致', metadata: {} },
  { id: 'T021', recordId: 'R006', eventType: 'rate_version_change', timestamp: '2026-05-30T10:35:00', description: '费率版本变更晚到：v2.3 → v2.4，经纪商确认为 v2.4', metadata: { oldVersion: 'v2.3', newVersion: 'v2.4' } },
  { id: 'T022', recordId: 'R006', eventType: 'conclusion', timestamp: '2026-05-30T10:35:00', description: '对账结论：费率版本错且晚到，经纪商费率确认新版本，结论金额 ¥720.00', metadata: {} },

  { id: 'T023', recordId: 'R007', eventType: 'order_created', timestamp: '2026-05-30T10:45:00', description: '撮合订单 ORD-20260530-0007 创建，上交所，撮合费 ¥4,100.00（旧费率 v2.2）', metadata: {} },
  { id: 'T024', recordId: 'R007', eventType: 'order_cancelled', timestamp: '2026-05-30T10:46:00', description: '订单撤销，撤单仍计费 ¥4,100.00', metadata: { feeAfterCancel: 4100 } },
  { id: 'T025', recordId: 'R007', eventType: 'cross_market_tag', timestamp: '2026-05-30T10:48:00', description: '跨市场重复标记：深交所成交扣减 ¥2,050.00', metadata: {} },
  { id: 'T026', recordId: 'R007', eventType: 'rate_version_change', timestamp: '2026-05-30T10:52:00', description: '费率版本变更晚到：v2.2 → v2.4，按新费率再扣减 ¥100.00', metadata: { oldVersion: 'v2.2', newVersion: 'v2.4' } },
  { id: 'T027', recordId: 'R007', eventType: 'conclusion', timestamp: '2026-05-30T10:52:00', description: '对账结论：三重叠加，4100 - 2050 - 100 = ¥1,950.00', metadata: {} },

  { id: 'T028', recordId: 'R008', eventType: 'order_created', timestamp: '2026-05-29T14:00:00', description: '撮合订单 ORD-20260529-0008 创建，股转系统，撮合费 ¥560.00', metadata: {} },
  { id: 'T029', recordId: 'R008', eventType: 'trade_report', timestamp: '2026-05-29T14:00:05', description: '成交回报确认，金额一致', metadata: {} },
  { id: 'T030', recordId: 'R008', eventType: 'conclusion', timestamp: '2026-05-29T16:30:00', description: '对账结论：一致，已解决', metadata: {} },

  { id: 'T031', recordId: 'R009', eventType: 'order_created', timestamp: '2026-05-29T11:00:00', description: '撮合订单 ORD-20260529-0009 创建，上交所，撮合费 ¥1,800.00（旧费率 v2.2）', metadata: {} },
  { id: 'T032', recordId: 'R009', eventType: 'trade_report', timestamp: '2026-05-29T11:00:05', description: '成交回报 ¥1,650.00（新费率 v2.3），与撮合不一致', metadata: {} },
  { id: 'T033', recordId: 'R009', eventType: 'rate_version_change', timestamp: '2026-05-29T11:10:00', description: '费率版本变更：v2.2 → v2.3', metadata: { oldVersion: 'v2.2', newVersion: 'v2.3' } },
  { id: 'T034', recordId: 'R009', eventType: 'conclusion', timestamp: '2026-05-29T17:00:00', description: '对账结论：费率版本差异，经纪商确认新版本，结论金额 ¥1,650.00', metadata: {} },

  { id: 'T035', recordId: 'R010', eventType: 'order_created', timestamp: '2026-05-29T13:20:00', description: '撮合订单 ORD-20260529-0010 创建，深交所，撮合费 ¥950.00', metadata: {} },
  { id: 'T036', recordId: 'R010', eventType: 'trade_report', timestamp: '2026-05-29T13:20:05', description: '成交回报确认，深交所 ¥950.00', metadata: {} },
  { id: 'T037', recordId: 'R010', eventType: 'cross_market_tag', timestamp: '2026-05-29T13:25:00', description: '跨市场重复标记：上交所亦有成交', metadata: {} },
  { id: 'T038', recordId: 'R010', eventType: 'conclusion', timestamp: '2026-05-30T09:00:00', description: '对账结论：跨市场重复已扣减，结论金额 ¥0', metadata: {} },

  { id: 'T039', recordId: 'R011', eventType: 'order_created', timestamp: '2026-05-30T11:00:00', description: '撮合订单 ORD-20260530-0011 创建，北交所，撮合费 ¥620.00', metadata: {} },
  { id: 'T040', recordId: 'R011', eventType: 'trade_report', timestamp: '2026-05-30T11:00:05', description: '成交回报确认，金额一致', metadata: {} },

  { id: 'T041', recordId: 'R012', eventType: 'order_created', timestamp: '2026-05-30T11:15:00', description: '撮合订单 ORD-20260530-0012 创建，上交所，撮合费 ¥2,400.00（旧费率 v2.3）', metadata: {} },
  { id: 'T042', recordId: 'R012', eventType: 'trade_report', timestamp: '2026-05-30T11:15:05', description: '成交回报 ¥2,200.00（新费率 v2.4）', metadata: {} },
  { id: 'T043', recordId: 'R012', eventType: 'rate_version_change', timestamp: '2026-05-30T11:20:00', description: '费率版本变更：v2.3 → v2.4', metadata: { oldVersion: 'v2.3', newVersion: 'v2.4' } },
]

const rateEvidences: BrokerRateEvidence[] = [
  {
    id: 'E001', recordId: 'R006', rateVersion: 'v2.4', effectiveTime: '2026-05-30T00:00:00',
    rateValue: 0.00012, matchingConclusion: '按旧费率 v2.3 计算为 ¥780.00',
    tradeReportConclusion: '按新费率 v2.4 计算为 ¥720.00', isInconsistent: true,
  },
  {
    id: 'E002', recordId: 'R007', rateVersion: 'v2.4', effectiveTime: '2026-05-30T00:00:00',
    rateValue: 0.00010, matchingConclusion: '按旧费率 v2.2 计算为 ¥4,100.00',
    tradeReportConclusion: '按新费率 v2.4 应为 ¥3,900.00（撤单后按新费率重算）', isInconsistent: true,
  },
  {
    id: 'E003', recordId: 'R009', rateVersion: 'v2.3', effectiveTime: '2026-05-29T00:00:00',
    rateValue: 0.00011, matchingConclusion: '按旧费率 v2.2 计算为 ¥1,800.00',
    tradeReportConclusion: '按新费率 v2.3 计算为 ¥1,650.00', isInconsistent: true,
  },
]

const feeRecalcDetails: FeeRecalcDetail[] = [
  { id: 'FR001', recordId: 'R004', step: 1, beforeRate: 0.00013, afterRate: 0.00012, beforeFee: 1560, afterFee: 1480, reason: '费率版本 v2.3 → v2.4，新费率更低', timestamp: '2026-05-30T10:05:00' },
  { id: 'FR002', recordId: 'R006', step: 1, beforeRate: 0.00013, afterRate: 0.00012, beforeFee: 780, afterFee: 720, reason: '费率版本 v2.3 → v2.4，经纪商确认新版本', timestamp: '2026-05-30T10:35:00' },
  { id: 'FR003', recordId: 'R007', step: 1, beforeRate: 0.00014, afterRate: 0.00012, beforeFee: 4100, afterFee: 3900, reason: '费率版本 v2.2 → v2.4，费率降低', timestamp: '2026-05-30T10:52:00' },
  { id: 'FR004', recordId: 'R007', step: 2, beforeRate: 0.00012, afterRate: 0.00012, beforeFee: 3900, afterFee: 1950, reason: '跨市场重复扣减：3900 - 1950 = 1950', timestamp: '2026-05-30T10:52:30' },
  { id: 'FR005', recordId: 'R009', step: 1, beforeRate: 0.00012, afterRate: 0.00011, beforeFee: 1800, afterFee: 1650, reason: '费率版本 v2.2 → v2.3', timestamp: '2026-05-29T11:10:00' },
  { id: 'FR006', recordId: 'R012', step: 1, beforeRate: 0.00013, afterRate: 0.00012, beforeFee: 2400, afterFee: 2200, reason: '费率版本 v2.3 → v2.4', timestamp: '2026-05-30T11:20:00' },
]

const cancelRollbackDetails: CancelRollbackDetail[] = [
  { id: 'CR001', recordId: 'R002', step: 1, beforeFee: 0, afterFee: 890.50, rollbackReason: '撤单仍计费：订单虽已撤销，但撮合费已产生，不回滚', timestamp: '2026-05-30T09:23:15' },
  { id: 'CR002', recordId: 'R005', step: 1, beforeFee: 0, afterFee: 3200, rollbackReason: '撤单仍计费：撮合费已产生', timestamp: '2026-05-30T10:16:00' },
  { id: 'CR003', recordId: 'R005', step: 2, beforeFee: 3200, afterFee: 1600, rollbackReason: '跨市场重复扣减：撤单计费 + 跨市场重复同时出现，扣减一半', timestamp: '2026-05-30T10:18:00' },
  { id: 'CR004', recordId: 'R007', step: 1, beforeFee: 0, afterFee: 4100, rollbackReason: '撤单仍计费：撮合费已产生', timestamp: '2026-05-30T10:46:00' },
  { id: 'CR005', recordId: 'R007', step: 2, beforeFee: 4100, afterFee: 2050, rollbackReason: '跨市场重复扣减', timestamp: '2026-05-30T10:48:00' },
  { id: 'CR006', recordId: 'R007', step: 3, beforeFee: 2050, afterFee: 1950, rollbackReason: '费率版本变更再扣减：新费率更低', timestamp: '2026-05-30T10:52:00' },
]

export function getBrokers() {
  return brokers
}

export function getRecords(): ReconciliationRecord[] {
  return records
}

export function getTimelineEvents(recordId: string): TimelineEvent[] {
  return timelineEvents.filter(e => e.recordId === recordId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function getRateEvidence(recordId: string): BrokerRateEvidence | undefined {
  return rateEvidences.find(e => e.recordId === recordId)
}

export function getFeeRecalcDetails(recordId: string): FeeRecalcDetail[] {
  return feeRecalcDetails.filter(d => d.recordId === recordId).sort((a, b) => a.step - b.step)
}

export function getCancelRollbackDetails(recordId: string): CancelRollbackDetail[] {
  return cancelRollbackDetails.filter(d => d.recordId === recordId).sort((a, b) => a.step - b.step)
}

export function getRecordById(recordId: string): ReconciliationRecord | undefined {
  return records.find(r => r.id === recordId)
}
