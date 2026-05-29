import { RoomConfig } from '@/types'

export function calculateWallArea(room: RoomConfig): number {
  const { length, width, height } = room
  return 2 * (length + width) * height
}

export function calculateCeilingArea(room: RoomConfig): number {
  return room.length * room.width
}

export function calculateTotalArea(room: RoomConfig): number {
  return calculateWallArea(room) + calculateCeilingArea(room)
}

export function calculateBudgetPerSqm(room: RoomConfig): number {
  if (room.budget <= 0) return Infinity
  const totalArea = calculateTotalArea(room)
  if (totalArea <= 0) return Infinity
  return Math.round(room.budget / totalArea)
}

export function calculateMaterialCost(unitPrice: number, area: number): number {
  return unitPrice * area
}

export function isBudgetOverrun(unitPrice: number, budgetPerSqm: number): boolean {
  if (budgetPerSqm === Infinity) return false
  return unitPrice > budgetPerSqm
}

export function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN')}`
}
