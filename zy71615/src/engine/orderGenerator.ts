import type { Order } from './types'

const COMMODITIES = [
  { name: '电子产品', emoji: '💻' },
  { name: '纺织品', emoji: '🧵' },
  { name: '机械设备', emoji: '⚙️' },
  { name: '农副产品', emoji: '🌾' },
  { name: '化工原料', emoji: '🧪' },
  { name: '家具建材', emoji: '🏗️' },
  { name: '汽车配件', emoji: '🔧' },
  { name: '食品饮料', emoji: '🍜' },
]

export function generateOrders(
  round: number,
  count: number,
  totalRounds: number,
  forcedOrders?: Partial<Order>[]
): Order[] {
  if (forcedOrders) {
    return forcedOrders.map((fo, i) => ({
      id: `ORD-R${round}-${i + 1}`,
      commodity: fo.commodity ?? COMMODITIES[i % COMMODITIES.length].name,
      quantity: fo.quantity ?? (1 + Math.floor(Math.random() * 3)),
      foreignPrice: fo.foreignPrice ?? (5000 + Math.floor(Math.random() * 15000)),
      currency: fo.currency ?? 'USD',
      deadlineRound: fo.deadlineRound ?? Math.min(round + 2, totalRounds),
      breachRate: fo.breachRate ?? 0.2,
      status: 'pending',
      assignedContainerId: null,
      createdRound: round,
    }))
  }

  const orders: Order[] = []
  const usedIndices = new Set<number>()
  for (let i = 0; i < count; i++) {
    let idx: number
    do {
      idx = Math.floor(Math.random() * COMMODITIES.length)
    } while (usedIndices.has(idx) && usedIndices.size < COMMODITIES.length)
    usedIndices.add(idx)

    orders.push({
      id: `ORD-R${round}-${i + 1}`,
      commodity: COMMODITIES[idx].name,
      quantity: 1 + Math.floor(Math.random() * 3),
      foreignPrice: 5000 + Math.floor(Math.random() * 15000),
      currency: 'USD',
      deadlineRound: Math.min(round + 2, totalRounds),
      breachRate: 0.2,
      status: 'pending',
      assignedContainerId: null,
      createdRound: round,
    })
  }
  return orders
}

export function getCommodityEmoji(commodity: string): string {
  const found = COMMODITIES.find(c => c.name === commodity)
  return found ? found.emoji : '📦'
}
