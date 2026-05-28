import type {
  GameEvent, RiskRecord, CashTransaction, CustomerOrder,
  PendingShipment, ExchangeRate, Supplier, InventoryItem,
  InventoryTransaction, RoundSnapshot, BusinessReport, RoundSummary,
  GameSession,
} from '@/types/game'
import {
  MATERIALS, SUPPLIERS, INITIAL_EXCHANGE_RATE, INITIAL_CASH,
  MAX_ROUNDS, EVENT_TEMPLATES, ORDER_TEMPLATES, SWITCH_SUPPLIER_COST,
  EMERGENCY_PURCHASE_MARKUP, PENALTY_RATE,
} from '@/data/gameConfig'

let idCounter = 0
function genId(prefix: string): string {
  idCounter++
  return `${prefix}-${Date.now()}-${idCounter}`
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function convertToCny(amount: number, currency: string, rate: ExchangeRate): number {
  if (currency === 'CNY') return amount
  if (currency === 'USD') return amount * rate.USD_CNY
  if (currency === 'EUR') return amount * rate.EUR_CNY
  return amount
}

export function generateEvents(round: number, suppliers: Supplier[], rate: ExchangeRate): GameEvent[] {
  const events: GameEvent[] = []
  const eventCount = Math.random() < 0.3 ? 2 : 1
  const usedTypes = new Set<string>()

  for (let i = 0; i < eventCount; i++) {
    const template = pickRandom(EVENT_TEMPLATES)
    if (usedTypes.has(template.type) && eventCount > 1) {
      const alt = EVENT_TEMPLATES.find(t => !usedTypes.has(t.type))
      if (!alt) continue
      const t = alt
      usedTypes.add(t.type)
      const desc = pickRandom(t.descriptions)
      const impact = randInt(t.impactRange[0], t.impactRange[1])
      events.push({
        id: genId('EVT'),
        type: t.type,
        description: desc,
        impact,
        round,
        resolved: false,
      })
    } else {
      usedTypes.add(template.type)
      let desc = pickRandom(template.descriptions)
      const impact = randInt(template.impactRange[0], template.impactRange[1])

      if (template.type === 'SUPPLIER_DISRUPTION') {
        const activeSuppliers = suppliers.filter(s => s.isActive && s.disruptionRound === null)
        if (activeSuppliers.length === 0) continue
        const target = pickRandom(activeSuppliers)
        const duration = impact
        desc = desc.replace('{supplier}', target.name).replace('{duration}', String(duration))
      }

      events.push({
        id: genId('EVT'),
        type: template.type,
        description: desc,
        impact,
        round,
        resolved: false,
      })
    }
  }

  return events
}

export function applyEvents(
  events: GameEvent[],
  suppliers: Supplier[],
  pendingShipments: PendingShipment[],
  rate: ExchangeRate,
): {
  suppliers: Supplier[]
  pendingShipments: PendingShipment[]
  rate: ExchangeRate
  riskRecords: RiskRecord[]
} {
  const updatedSuppliers = suppliers.map(s => ({ ...s }))
  const updatedShipments = pendingShipments.map(s => ({ ...s }))
  const riskRecords: RiskRecord[] = []
  let newRate = { ...rate }

  for (const event of events) {
    if (event.type === 'PORT_CONGESTION') {
      for (const ship of updatedShipments) {
        if (!ship.isDelayed) {
          ship.isDelayed = true
          ship.originalArrivalRound = ship.arrivalRound
          ship.arrivalRound += event.impact
        }
      }
    }

    if (event.type === 'EXCHANGE_RATE') {
      const isUsd = event.description.includes('美元')
      const isEur = event.description.includes('欧元')
      const isPositive = event.description.includes('下降') || event.description.includes('走强')
      const changePercent = event.impact / 100

      if (isUsd) {
        newRate.USD_CNY = isPositive
          ? newRate.USD_CNY * (1 - changePercent)
          : newRate.USD_CNY * (1 + changePercent)
      } else if (isEur) {
        newRate.EUR_CNY = isPositive
          ? newRate.EUR_CNY * (1 - changePercent)
          : newRate.EUR_CNY * (1 + changePercent)
      } else {
        if (Math.random() < 0.5) {
          newRate.USD_CNY *= (1 + changePercent)
        } else {
          newRate.EUR_CNY *= (1 + changePercent)
        }
      }

      riskRecords.push({
        id: genId('RSK'),
        type: 'FX_LOSS',
        materialId: isUsd ? 'M001' : isEur ? 'M003' : 'M001',
        amount: Math.round(event.impact * 1000),
        description: `汇率波动导致${isUsd ? '美元' : isEur ? '欧元' : '外币'}采购成本变化${event.impact}%`,
        round: event.round,
      })
    }

    if (event.type === 'SUPPLIER_DISRUPTION') {
      const desc = event.description
      for (const s of updatedSuppliers) {
        if (desc.includes(s.name) && s.disruptionRound === null) {
          s.disruptionRound = event.round
          s.disruptionDuration = event.impact
          s.isActive = false
          riskRecords.push({
            id: genId('RSK'),
            type: 'DISRUPTION',
            materialId: s.materialId,
            amount: Math.round(s.unitPrice * 100 * event.impact),
            description: `${s.name}断供${event.impact}个回合，${MATERIALS.find(m => m.id === s.materialId)?.name || s.materialId}供应中断`,
            round: event.round,
          })
        }
      }
    }
  }

  return { suppliers: updatedSuppliers, pendingShipments: updatedShipments, rate: newRate, riskRecords }
}

export function generateOrders(round: number, rate: ExchangeRate): CustomerOrder[] {
  const orders: CustomerOrder[] = []
  const count = randInt(1, 3)

  for (let i = 0; i < count; i++) {
    const tmpl = pickRandom(ORDER_TEMPLATES)
    const material = MATERIALS.find(m => m.id === tmpl.materialId)!
    const quantity = randInt(tmpl.quantityRange[0], tmpl.quantityRange[1])
    const priceMult = randFloat(tmpl.priceMultiplier[0], tmpl.priceMultiplier[1])
    const unitPriceCny = convertToCny(material.unitCost * priceMult, material.currency, rate)
    const deadline = round + randInt(tmpl.deadlineRange[0], tmpl.deadlineRange[1])

    orders.push({
      id: genId('ORD'),
      materialId: tmpl.materialId,
      quantity,
      deadline: Math.min(deadline, MAX_ROUNDS),
      unitPrice: Math.round(unitPriceCny),
      isDelivered: false,
      isExpired: false,
      penaltyAmount: 0,
      roundCreated: round,
    })
  }

  return orders
}

export function processArrivals(
  round: number,
  pendingShipments: PendingShipment[],
  inventory: InventoryItem[],
): { inventory: InventoryItem[]; arrivedShipments: PendingShipment[] } {
  const updatedInventory = inventory.map(item => ({
    ...item,
    transactions: [...item.transactions],
  }))
  const arrived: PendingShipment[] = []

  for (const ship of pendingShipments) {
    if (ship.arrivalRound <= round) {
      arrived.push(ship)
      const item = updatedInventory.find(i => i.materialId === ship.materialId)
      if (item) {
        item.quantity += ship.quantity
        item.transactions.push({
          round,
          type: 'IN',
          quantity: ship.quantity,
          source: ship.supplierId,
          materialId: ship.materialId,
        })
      }
    }
  }

  return { inventory: updatedInventory, arrivedShipments: arrived }
}

export function checkBacklogRisk(inventory: InventoryItem[], round: number): RiskRecord[] {
  const records: RiskRecord[] = []

  for (const item of inventory) {
    const material = MATERIALS.find(m => m.id === item.materialId)
    if (!material) continue

    if (item.quantity > material.safetyStock * 3) {
      records.push({
        id: genId('RSK'),
        type: 'BACKLOG',
        materialId: item.materialId,
        amount: Math.round(item.quantity * material.unitCost * 0.1),
        description: `${material.name}库存积压(${item.quantity}件)，超出安全库存3倍`,
        round,
      })
    }
  }

  return records
}

export function checkExpiredOrders(
  round: number,
  orders: CustomerOrder[],
): { orders: CustomerOrder[]; penaltyTotal: number; penalties: CashTransaction[] } {
  const updated = orders.map(o => ({ ...o }))
  let penaltyTotal = 0
  const penalties: CashTransaction[] = []

  for (const order of updated) {
    if (!order.isDelivered && !order.isExpired && order.deadline < round) {
      order.isExpired = true
      const penalty = Math.round(order.quantity * order.unitPrice * PENALTY_RATE)
      order.penaltyAmount = penalty
      penaltyTotal += penalty
      penalties.push({
        id: genId('TXN'),
        type: 'PENALTY',
        amount: penalty,
        description: `订单${order.id}违约罚金(${MATERIALS.find(m => m.id === order.materialId)?.name || order.materialId}×${order.quantity})`,
        round,
      })
    }
  }

  return { orders: updated, penaltyTotal, penalties }
}

export function recoverSuppliers(round: number, suppliers: Supplier[]): Supplier[] {
  return suppliers.map(s => {
    if (s.disruptionRound !== null && s.disruptionDuration > 0) {
      const roundsSinceDisruption = round - s.disruptionRound
      if (roundsSinceDisruption >= s.disruptionDuration) {
        return {
          ...s,
          isActive: true,
          disruptionRound: null,
          disruptionDuration: 0,
        }
      }
    }
    return s
  })
}

export function purchaseFromSupplier(
  supplierId: string,
  quantity: number,
  round: number,
  rate: ExchangeRate,
  suppliers: Supplier[],
): { shipment: PendingShipment | null; transaction: CashTransaction | null; cost: number } {
  const supplier = suppliers.find(s => s.id === supplierId)
  if (!supplier || !supplier.isActive) return { shipment: null, transaction: null, cost: 0 }

  const totalForeign = supplier.unitPrice * quantity
  const costInCny = convertToCny(totalForeign, supplier.currency, rate)
  const arrivalRound = round + supplier.leadTime

  const shipment: PendingShipment = {
    id: genId('SHP'),
    supplierId,
    materialId: supplier.materialId,
    quantity,
    arrivalRound,
    costInCny: Math.round(costInCny),
    isDelayed: false,
    originalArrivalRound: arrivalRound,
  }

  const transaction: CashTransaction = {
    id: genId('TXN'),
    type: 'EXPENSE',
    amount: Math.round(costInCny),
    description: `采购${MATERIALS.find(m => m.id === supplier.materialId)?.name || supplier.materialId}×${quantity}(${supplier.name})`,
    round,
  }

  return { shipment, transaction, cost: Math.round(costInCny) }
}

export function emergencyPurchase(
  materialId: string,
  quantity: number,
  round: number,
  rate: ExchangeRate,
): { shipment: PendingShipment; transaction: CashTransaction } {
  const material = MATERIALS.find(m => m.id === materialId)!
  const costPerUnit = convertToCny(material.unitCost * EMERGENCY_PURCHASE_MARKUP, material.currency, rate)

  const shipment: PendingShipment = {
    id: genId('SHP'),
    supplierId: 'EMERGENCY',
    materialId,
    quantity,
    arrivalRound: round + 1,
    costInCny: Math.round(costPerUnit * quantity),
    isDelayed: false,
    originalArrivalRound: round + 1,
  }

  const transaction: CashTransaction = {
    id: genId('TXN'),
    type: 'EXPENSE',
    amount: Math.round(costPerUnit * quantity),
    description: `紧急采购${material.name}×${quantity}(加价${Math.round((EMERGENCY_PURCHASE_MARKUP - 1) * 100)}%)`,
    round,
  }

  return { shipment, transaction }
}

export function deliverOrder(
  orderId: string,
  orders: CustomerOrder[],
  inventory: InventoryItem[],
  round: number,
): {
  orders: CustomerOrder[]
  inventory: InventoryItem[]
  transaction: CashTransaction | null
  error: string | null
} {
  const order = orders.find(o => o.id === orderId)
  if (!order) return { orders, inventory, transaction: null, error: '订单不存在' }
  if (order.isDelivered) return { orders, inventory, transaction: null, error: '订单已交付' }
  if (order.isExpired) return { orders, inventory, transaction: null, error: '订单已过期' }

  const invItem = inventory.find(i => i.materialId === order.materialId)
  if (!invItem || invItem.quantity < order.quantity) {
    return { orders, inventory, transaction: null, error: '库存不足' }
  }

  const updatedOrders = orders.map(o =>
    o.id === orderId ? { ...o, isDelivered: true } : o
  )

  const updatedInventory = inventory.map(item => {
    if (item.materialId === order.materialId) {
      return {
        ...item,
        quantity: item.quantity - order.quantity,
        transactions: [
          ...item.transactions,
          {
            round,
            type: 'OUT' as const,
            quantity: order.quantity,
            source: `订单${orderId}`,
            materialId: order.materialId,
          },
        ],
      }
    }
    return item
  })

  const revenue = order.quantity * order.unitPrice
  const transaction: CashTransaction = {
    id: genId('TXN'),
    type: 'INCOME',
    amount: revenue,
    description: `交付订单${orderId}(${MATERIALS.find(m => m.id === order.materialId)?.name || order.materialId}×${order.quantity})`,
    round,
  }

  return { orders: updatedOrders, inventory: updatedInventory, transaction, error: null }
}

export function switchSupplier(
  newSupplierId: string,
  currentSupplierId: string,
  suppliers: Supplier[],
  round: number,
): { suppliers: Supplier[]; transaction: CashTransaction; error: string | null } {
  const newSupplier = suppliers.find(s => s.id === newSupplierId)
  if (!newSupplier) return { suppliers, transaction: { id: '', type: 'EXPENSE', amount: 0, description: '', round }, error: '供应商不存在' }
  if (!newSupplier.isActive) return { suppliers, transaction: { id: '', type: 'EXPENSE', amount: 0, description: '', round }, error: '供应商已断供' }
  if (newSupplierId === currentSupplierId) return { suppliers, transaction: { id: '', type: 'EXPENSE', amount: 0, description: '', round }, error: '已是当前供应商' }

  const updatedSuppliers = suppliers.map(s => ({ ...s }))
  const transaction: CashTransaction = {
    id: genId('TXN'),
    type: 'EXPENSE',
    amount: SWITCH_SUPPLIER_COST,
    description: `切换供应商至${newSupplier.name}（手续费¥${SWITCH_SUPPLIER_COST.toLocaleString()}）`,
    round,
  }

  return { suppliers: updatedSuppliers, transaction, error: null }
}

export function generateReport(session: GameSession): BusinessReport {
  const riskRecords = [...session.riskRecords]

  const seenMaterialIds = new Set<string>()
  const uniqueMaterialIds: string[] = []
  for (const r of riskRecords) {
    if (!seenMaterialIds.has(r.materialId)) {
      seenMaterialIds.add(r.materialId)
      uniqueMaterialIds.push(r.materialId)
    }
  }

  const totalRevenue = session.cashTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = session.cashTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalFxLoss = session.cashTransactions
    .filter(t => t.type === 'FX_LOSS')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalPenalty = session.cashTransactions
    .filter(t => t.type === 'PENALTY')
    .reduce((sum, t) => sum + t.amount, 0)
  const netProfit = totalRevenue - totalExpense - totalFxLoss - totalPenalty

  const roundSummaries: RoundSummary[] = []
  for (let r = 1; r <= session.currentRound; r++) {
    const roundTxns = session.cashTransactions.filter(t => t.round === r)
    const roundEvents = session.events.filter(e => e.round === r)
    roundSummaries.push({
      round: r,
      revenue: roundTxns.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
      expense: roundTxns.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
      fxLoss: roundTxns.filter(t => t.type === 'FX_LOSS').reduce((s, t) => s + t.amount, 0),
      penalty: roundTxns.filter(t => t.type === 'PENALTY').reduce((s, t) => s + t.amount, 0),
      profit: 0,
      eventCount: roundEvents.length,
    })
    const rs = roundSummaries[roundSummaries.length - 1]
    rs.profit = rs.revenue - rs.expense - rs.fxLoss - rs.penalty
  }

  return {
    sessionId: session.id,
    totalRevenue,
    totalExpense,
    totalFxLoss,
    totalPenalty,
    netProfit,
    riskRecords,
    materialIds: uniqueMaterialIds,
    roundSummaries,
  }
}

export function createSnapshot(session: GameSession): RoundSnapshot {
  const invMap: Record<string, number> = {}
  for (const item of session.inventory) {
    invMap[item.materialId] = item.quantity
  }

  return {
    round: session.currentRound,
    events: session.events.filter(e => e.round === session.currentRound).map(e => ({ ...e })),
    actions: [...session.currentRoundActions],
    cashAfterRound: session.cash,
    inventoryAfterRound: invMap,
    exchangeRate: { ...session.exchangeRate },
  }
}

export function createNewSession(): GameSession {
  const id = genId('GSM')
  const inventory: InventoryItem[] = MATERIALS.map(m => ({
    materialId: m.id,
    quantity: m.safetyStock,
    transactions: [{
      round: 0,
      type: 'IN',
      quantity: m.safetyStock,
      source: '初始库存',
      materialId: m.id,
    }],
  }))

  return {
    id,
    currentRound: 0,
    maxRounds: MAX_ROUNDS,
    cash: INITIAL_CASH,
    exchangeRate: { ...INITIAL_EXCHANGE_RATE },
    materials: MATERIALS.map(m => ({ ...m })),
    suppliers: SUPPLIERS.map(s => ({ ...s })),
    inventory,
    events: [],
    riskRecords: [],
    cashTransactions: [],
    orders: [],
    pendingShipments: [],
    selectedSupplierId: 'S001',
    isFinished: false,
    report: null,
    roundSnapshots: [],
    currentRoundActions: [],
    isRoundActive: false,
  }
}
