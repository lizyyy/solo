import { UNIT_FACTORS, DEFAULT_UNITS } from '@/types'

export function convertTemperature(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return value

  const fromC = fromUnit === '°C' || fromUnit === '℃' || fromUnit === 'C'
  const fromF = fromUnit === '°F' || fromUnit === 'F'
  const toC = toUnit === '°C' || toUnit === '℃' || toUnit === 'C'
  const toF = toUnit === '°F' || toUnit === 'F'

  let celsius = value
  if (fromF) {
    celsius = (value - 32) * 5 / 9
  }

  if (toC) return parseFloat(celsius.toFixed(4))
  if (toF) return parseFloat((celsius * 9 / 5 + 32).toFixed(4))

  return value
}

export function convertValue(
  value: number,
  field: 'temperature' | 'mileage' | 'vehicleCapacity',
  fromUnit: string,
  toUnit: string
): number {
  if (fromUnit === toUnit) return value

  if (field === 'temperature') {
    return convertTemperature(value, fromUnit, toUnit)
  }

  const factors = UNIT_FACTORS[field] || {}
  const fromFactor = factors[fromUnit] ?? 1
  const toFactor = factors[toUnit] ?? 1
  const result = value * (fromFactor / toFactor)
  return parseFloat(result.toFixed(4))
}

export function extractUnitFromHeader(header: string): { fieldName: string; unit: string | null } {
  const match = header.match(/^(.*?)[（(]([^)）]+)[)）]$/)
  if (match) {
    return { fieldName: match[1].trim(), unit: match[2].trim() }
  }
  return { fieldName: header.trim(), unit: null }
}

export function detectFieldType(header: string): 'temperature' | 'mileage' | 'vehicleCapacity' | 'routeId' | 'warehouseId' | null {
  const h = header.toLowerCase()
  if (h.includes('路线') || h.includes('线路') || h.includes('route')) return 'routeId'
  if (h.includes('温度') || h.includes('temp')) return 'temperature'
  if (h.includes('里程') || h.includes('距离') || h.includes('mile') || h.includes('dist')) return 'mileage'
  if (h.includes('容量') || h.includes('载重') || h.includes('重量') || h.includes('cap') || h.includes('weight')) return 'vehicleCapacity'
  if (h.includes('仓库') || h.includes('warehouse') || h.includes('wh')) return 'warehouseId'
  return null
}

export function getStandardUnit(field: 'temperature' | 'mileage' | 'vehicleCapacity'): string {
  return DEFAULT_UNITS[field]?.unit || (field === 'temperature' ? '°C' : field === 'mileage' ? 'km' : '吨')
}
