import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { InspectionItem, ApplianceType } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function generateAppointmentNo(): string {
  const date = format(new Date(), 'yyyyMMdd')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `AP${date}${random}`
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'yyyy-MM-dd HH:mm:ss')
}

export function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`
}

export function getDefaultInspectionItems(applianceType: ApplianceType): InspectionItem[] {
  const baseItems: InspectionItem[] = [
    { id: generateId(), name: '外观检查', category: 'basic', result: null, notes: '', checked: false },
    { id: generateId(), name: '遥控器检查', category: 'accessories', result: null, notes: '', checked: false },
    { id: generateId(), name: '电源线检查', category: 'basic', result: null, notes: '', checked: false },
    { id: generateId(), name: '功能测试', category: 'function', result: null, notes: '', checked: false },
    { id: generateId(), name: '内部清洁度', category: 'internal', result: null, notes: '', checked: false },
    { id: generateId(), name: '维修历史', category: 'history', result: null, notes: '', checked: false },
  ]

  const typeSpecificItems: Record<ApplianceType, InspectionItem[]> = {
    [ApplianceType.TV]: [
      { id: generateId(), name: '屏幕显示', category: 'display', result: null, notes: '', checked: false },
      { id: generateId(), name: '声音输出', category: 'audio', result: null, notes: '', checked: false },
      { id: generateId(), name: '接口测试', category: 'ports', result: null, notes: '', checked: false },
    ],
    [ApplianceType.REFRIGERATOR]: [
      { id: generateId(), name: '制冷效果', category: 'cooling', result: null, notes: '', checked: false },
      { id: generateId(), name: '密封条检查', category: 'seal', result: null, notes: '', checked: false },
      { id: generateId(), name: '压缩机噪音', category: 'noise', result: null, notes: '', checked: false },
    ],
    [ApplianceType.WASHING_MACHINE]: [
      { id: generateId(), name: '洗涤功能', category: 'washing', result: null, notes: '', checked: false },
      { id: generateId(), name: '脱水功能', category: 'spinning', result: null, notes: '', checked: false },
      { id: generateId(), name: '进排水系统', category: 'water', result: null, notes: '', checked: false },
    ],
    [ApplianceType.AIR_CONDITIONER]: [
      { id: generateId(), name: '制冷制热', category: 'temperature', result: null, notes: '', checked: false },
      { id: generateId(), name: '风速调节', category: 'fan', result: null, notes: '', checked: false },
      { id: generateId(), name: '冷媒压力', category: 'refrigerant', result: null, notes: '', checked: false },
    ],
    [ApplianceType.WATER_HEATER]: [
      { id: generateId(), name: '加热功能', category: 'heating', result: null, notes: '', checked: false },
      { id: generateId(), name: '保温效果', category: 'insulation', result: null, notes: '', checked: false },
      { id: generateId(), name: '安全阀门', category: 'safety', result: null, notes: '', checked: false },
    ],
    [ApplianceType.OTHER]: [],
  }

  return [...baseItems, ...typeSpecificItems[applianceType]]
}

export function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    inspected: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    settled: 'bg-gray-100 text-gray-800',
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

export function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    pending: '待上门',
    in_progress: '检测中',
    inspected: '已检测',
    rejected: '已拒收',
    settled: '已结算',
  }
  return texts[status] || status
}

export function getApplianceTypeText(type: string): string {
  const texts: Record<string, string> = {
    tv: '电视',
    refrigerator: '冰箱',
    washing_machine: '洗衣机',
    air_conditioner: '空调',
    water_heater: '热水器',
    other: '其他',
  }
  return texts[type] || type
}
