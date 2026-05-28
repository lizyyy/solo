import type { Material, Supplier, ExchangeRate } from '@/types/game'

export const INITIAL_CASH = 1000000
export const MAX_ROUNDS = 12
export const SWITCH_SUPPLIER_COST = 50000
export const EMERGENCY_PURCHASE_MARKUP = 1.5
export const PENALTY_RATE = 0.3

export const INITIAL_EXCHANGE_RATE: ExchangeRate = {
  USD_CNY: 7.2,
  EUR_CNY: 7.85,
}

export const MATERIALS: Material[] = [
  { id: 'M001', name: '电子元件', safetyStock: 200, unitCost: 50, currency: 'USD' },
  { id: 'M002', name: '钢材', safetyStock: 500, unitCost: 30, currency: 'CNY' },
  { id: 'M003', name: '芯片', safetyStock: 100, unitCost: 80, currency: 'EUR' },
  { id: 'M004', name: '塑料颗粒', safetyStock: 300, unitCost: 20, currency: 'CNY' },
]

export const SUPPLIERS: Supplier[] = [
  {
    id: 'S001', name: '华东电子', reliability: 85, leadTime: 2,
    unitPrice: 48, currency: 'USD', materialId: 'M001',
    isActive: true, disruptionRound: null, disruptionDuration: 0,
  },
  {
    id: 'S002', name: '深圳速联', reliability: 55, leadTime: 1,
    unitPrice: 42, currency: 'USD', materialId: 'M001',
    isActive: true, disruptionRound: null, disruptionDuration: 0,
  },
  {
    id: 'S003', name: '宝钢直供', reliability: 90, leadTime: 2,
    unitPrice: 28, currency: 'CNY', materialId: 'M002',
    isActive: true, disruptionRound: null, disruptionDuration: 0,
  },
  {
    id: 'S004', name: '欧芯科技', reliability: 65, leadTime: 3,
    unitPrice: 75, currency: 'EUR', materialId: 'M003',
    isActive: true, disruptionRound: null, disruptionDuration: 0,
  },
  {
    id: 'S005', name: '中塑集团', reliability: 80, leadTime: 1,
    unitPrice: 18, currency: 'CNY', materialId: 'M004',
    isActive: true, disruptionRound: null, disruptionDuration: 0,
  },
]

export const EVENT_TEMPLATES = [
  {
    type: 'PORT_CONGESTION' as const,
    descriptions: [
      '上海港严重拥堵，所有海运货物延迟2个回合到货',
      '宁波舟山港受台风影响，到港货物延迟1个回合',
      '深圳盐田港作业受限，货物通关延迟2个回合',
    ],
    impactRange: [1, 2],
  },
  {
    type: 'EXCHANGE_RATE' as const,
    descriptions: [
      '美元兑人民币汇率波动，采购成本上升',
      '欧元区经济数据利好，欧元升值推高进口成本',
      '人民币走强，外汇采购成本有所下降',
    ],
    impactRange: [5, 15],
  },
  {
    type: 'SUPPLIER_DISRUPTION' as const,
    descriptions: [
      '{supplier}突发设备故障，暂停供货{duration}个回合',
      '{supplier}工人罢工，无法正常交付{duration}个回合',
      '{supplier}原材料短缺，产能受限{duration}个回合',
    ],
    impactRange: [2, 3],
  },
]

export const ORDER_TEMPLATES = [
  { materialId: 'M001', quantityRange: [150, 400], priceMultiplier: [1.8, 2.5], deadlineRange: [3, 5] },
  { materialId: 'M002', quantityRange: [300, 800], priceMultiplier: [1.5, 2.2], deadlineRange: [2, 4] },
  { materialId: 'M003', quantityRange: [80, 200], priceMultiplier: [2.0, 3.0], deadlineRange: [3, 6] },
  { materialId: 'M004', quantityRange: [200, 600], priceMultiplier: [1.4, 2.0], deadlineRange: [2, 4] },
]
