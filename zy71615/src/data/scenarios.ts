import type { ExchangeRate, Order, CabinSlot } from '../engine/types'

export interface RoundScenario {
  rate: number
  orders: Partial<Order>[]
}

export const SCENARIOS: Record<number, RoundScenario> = {
  1: {
    rate: 7.28,
    orders: [
      { commodity: '电子产品', quantity: 2, foreignPrice: 12000, deadlineRound: 3 },
      { commodity: '纺织品', quantity: 1, foreignPrice: 8000, deadlineRound: 3 },
      { commodity: '农副产品', quantity: 1, foreignPrice: 6000, deadlineRound: 3 },
    ],
  },
  2: {
    rate: 7.35,
    orders: [
      { commodity: '机械设备', quantity: 2, foreignPrice: 15000, deadlineRound: 4 },
      { commodity: '化工原料', quantity: 1, foreignPrice: 9000, deadlineRound: 4 },
      { commodity: '食品饮料', quantity: 2, foreignPrice: 7000, deadlineRound: 4 },
      { commodity: '家具建材', quantity: 1, foreignPrice: 11000, deadlineRound: 4 },
    ],
  },
  3: {
    rate: 6.90,
    orders: [
      { commodity: '汽车配件', quantity: 3, foreignPrice: 18000, deadlineRound: 5 },
      { commodity: '电子产品', quantity: 2, foreignPrice: 14000, deadlineRound: 5 },
      { commodity: '纺织品', quantity: 1, foreignPrice: 10000, deadlineRound: 5 },
      { commodity: '机械设备', quantity: 2, foreignPrice: 16000, deadlineRound: 5 },
      { commodity: '化工原料', quantity: 2, foreignPrice: 8500, deadlineRound: 5 },
    ],
  },
  4: {
    rate: 7.10,
    orders: [
      { commodity: '农副产品', quantity: 1, foreignPrice: 7500, deadlineRound: 6 },
      { commodity: '食品饮料', quantity: 2, foreignPrice: 9500, deadlineRound: 6 },
      { commodity: '家具建材', quantity: 1, foreignPrice: 13000, deadlineRound: 6 },
    ],
  },
  5: {
    rate: 7.42,
    orders: [
      { commodity: '汽车配件', quantity: 2, foreignPrice: 17000, deadlineRound: 6 },
      { commodity: '电子产品', quantity: 1, foreignPrice: 11000, deadlineRound: 6 },
      { commodity: '化工原料', quantity: 2, foreignPrice: 12000, deadlineRound: 6 },
      { commodity: '纺织品', quantity: 1, foreignPrice: 9000, deadlineRound: 6 },
    ],
  },
  6: {
    rate: 7.18,
    orders: [
      { commodity: '机械设备', quantity: 2, foreignPrice: 20000, deadlineRound: 6 },
      { commodity: '农副产品', quantity: 1, foreignPrice: 8500, deadlineRound: 6 },
      { commodity: '食品饮料', quantity: 1, foreignPrice: 7000, deadlineRound: 6 },
    ],
  },
}

export const DEFAULT_CABIN_TIERS: CabinSlot[] = [
  { id: 'cabin-first', tier: 'first', costPerContainer: 5000, capacity: 2, usedCapacity: 0, locked: false },
  { id: 'cabin-standard', tier: 'standard', costPerContainer: 3000, capacity: 4, usedCapacity: 0, locked: false },
  { id: 'cabin-economy', tier: 'economy', costPerContainer: 1500, capacity: 6, usedCapacity: 0, locked: false },
]

export const TRAP_ROUND = 3
export const TOTAL_ROUNDS = 6
export const INITIAL_BALANCE = 100000
export const CONTAINER_COUNT = 12
export const BASE_RATE = 7.20
