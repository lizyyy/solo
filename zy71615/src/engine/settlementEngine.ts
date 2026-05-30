import type {
  Order, ExchangeRate, CabinSlot, Container, LedgerEntry, TraceStep, ReportEntry, ErrorType,
} from './types'

export interface SettlementResult {
  ledgerEntries: LedgerEntry[]
  reportEntries: ReportEntry[]
  updatedOrders: Order[]
  updatedContainers: Container[]
  updatedCabinSlots: CabinSlot[]
}

export function settleRound(
  round: number,
  orders: Order[],
  containers: Container[],
  cabinSlots: CabinSlot[],
  currentRate: ExchangeRate,
  timestamp: number,
): SettlementResult {
  const ledgerEntries: LedgerEntry[] = []
  const reportEntries: ReportEntry[] = []
  const updatedOrders = orders.map(o => ({ ...o }))
  const updatedContainers = containers.map(c => ({ ...c }))
  const updatedCabinSlots = cabinSlots.map(s => ({ ...s }))

  const loadedOrders = updatedOrders.filter(o => o.status === 'loaded')
  const totalLoadedContainers = loadedOrders.reduce((sum, o) => sum + o.quantity, 0)

  const totalCabinCapacity = updatedCabinSlots
    .filter(s => s.locked)
    .reduce((sum, s) => sum + s.capacity, 0)

  const isOverbooked = totalLoadedContainers > totalCabinCapacity
  const overbookingCount = isOverbooked ? totalLoadedContainers - totalCabinCapacity : 0

  for (const order of loadedOrders) {
    const steps: TraceStep[] = []
    const errors: ErrorType[] = []

    steps.push({
      stage: 'order_selected',
      description: `选择订单 ${order.id}（${order.commodity} × ${order.quantity}）`,
      value: null,
    })

    steps.push({
      stage: 'container_assigned',
      description: `分配 ${order.quantity} 个货柜`,
      value: null,
    })

    const income = Math.round(order.foreignPrice * currentRate.rate)
    steps.push({
      stage: 'rate_locked',
      description: `汇率锁定 ${currentRate.rate.toFixed(4)}，收入 ¥${income.toLocaleString()}`,
      value: income,
    })

    if (currentRate.direction === 'down' && currentRate.rate < 7.0) {
      errors.push('exchange_rate_reversal')
    }

    ledgerEntries.push({
      id: `LED-${round}-${order.id}-INC`,
      round,
      type: 'income',
      amount: income,
      orderId: order.id,
      description: `订单 ${order.id} 结算收入（$${order.foreignPrice.toLocaleString()} × ${currentRate.rate.toFixed(4)}）`,
      timestamp,
    })

    const usedTier = updatedCabinSlots.find(s => s.locked && s.usedCapacity < s.capacity)
    if (usedTier) {
      const cabinFee = usedTier.costPerContainer * order.quantity
      steps.push({
        stage: 'cabin_booked',
        description: `${usedTier.tier === 'first' ? '头等舱' : usedTier.tier === 'standard' ? '标准舱' : '经济舱'} 费用 ¥${cabinFee.toLocaleString()}（${order.quantity} 柜 × ¥${usedTier.costPerContainer}）`,
        value: -cabinFee,
      })
      ledgerEntries.push({
        id: `LED-${round}-${order.id}-CAB`,
        round,
        type: 'cabin_fee',
        amount: -cabinFee,
        orderId: order.id,
        description: `舱位费（${usedTier.tier === 'first' ? '头等舱' : usedTier.tier === 'standard' ? '标准舱' : '经济舱'} × ${order.quantity} 柜）`,
        timestamp,
      })
      usedTier.usedCapacity += order.quantity
    }

    if (isOverbooked) {
      const overbookFee = 2000 * order.quantity
      steps.push({
        stage: 'breach_checked',
        description: `舱位超订！超订罚金 ¥${overbookFee.toLocaleString()}`,
        value: -overbookFee,
      })
      errors.push('cabin_overbooking')
      ledgerEntries.push({
        id: `LED-${round}-${order.id}-OVER`,
        round,
        type: 'overbooking_penalty',
        amount: -overbookFee,
        orderId: order.id,
        description: `超订罚金（超出 ${overbookingCount} 柜 × ¥2000）`,
        timestamp,
      })
    } else {
      steps.push({
        stage: 'breach_checked',
        description: '违约检查通过，无违约',
        value: null,
      })
    }

    order.status = 'shipped'
    const totalProfit = ledgerEntries
      .filter(e => e.orderId === order.id && e.round === round)
      .reduce((sum, e) => sum + e.amount, 0)
    steps.push({
      stage: 'settled',
      description: `最终利润 ¥${totalProfit.toLocaleString()}`,
      value: totalProfit,
    })

    reportEntries.push({
      id: `RPT-${round}-${order.id}`,
      round,
      orderId: order.id,
      steps,
      finalProfit: totalProfit,
      hasError: errors.length > 0,
      errorTypes: errors,
    })
  }

  const pendingOrders = updatedOrders.filter(
    o => o.status === 'pending' && o.deadlineRound <= round,
  )
  for (const order of pendingOrders) {
    const steps: TraceStep[] = []
    const errors: ErrorType[] = []

    steps.push({
      stage: 'order_selected',
      description: `订单 ${order.id}（${order.commodity}）逾期未装船`,
      value: null,
    })

    const penalty = Math.round(order.foreignPrice * order.breachRate)
    steps.push({
      stage: 'breach_checked',
      description: `违约！扣除订单金额 ${(order.breachRate * 100).toFixed(0)}% 作为违约金 ¥${penalty.toLocaleString()}`,
      value: -penalty,
    })
    errors.push('breach_penalty_missed')

    ledgerEntries.push({
      id: `LED-${round}-${order.id}-BR`,
      round,
      type: 'breach_penalty',
      amount: -penalty,
      orderId: order.id,
      description: `逾期违约金（${order.id}，${(order.breachRate * 100).toFixed(0)}%）`,
      timestamp,
    })

    order.status = 'breached'

    steps.push({
      stage: 'settled',
      description: `违约损失 ¥${penalty.toLocaleString()}`,
      value: -penalty,
    })

    reportEntries.push({
      id: `RPT-${round}-${order.id}`,
      round,
      orderId: order.id,
      steps,
      finalProfit: -penalty,
      hasError: true,
      errorTypes: errors,
    })
  }

  return {
    ledgerEntries,
    reportEntries,
    updatedOrders,
    updatedContainers,
    updatedCabinSlots,
  }
}
