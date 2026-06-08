import type { UnitDef, UnitValidation } from '@/types'

const UNITS: UnitDef[] = [
  { name: '米', symbol: 'm', category: 'length', toSI: (v) => v, fromSI: (v) => v },
  { name: '厘米', symbol: 'cm', category: 'length', toSI: (v) => v / 100, fromSI: (v) => v * 100 },
  { name: '毫米', symbol: 'mm', category: 'length', toSI: (v) => v / 1000, fromSI: (v) => v * 1000 },
  { name: '千米', symbol: 'km', category: 'length', toSI: (v) => v * 1000, fromSI: (v) => v / 1000 },
  { name: '英寸', symbol: 'in', category: 'length', toSI: (v) => v * 0.0254, fromSI: (v) => v / 0.0254 },
  { name: '英尺', symbol: 'ft', category: 'length', toSI: (v) => v * 0.3048, fromSI: (v) => v / 0.3048 },

  { name: '帕斯卡', symbol: 'Pa', category: 'pressure', toSI: (v) => v, fromSI: (v) => v },
  { name: '千帕', symbol: 'kPa', category: 'pressure', toSI: (v) => v * 1000, fromSI: (v) => v / 1000 },
  { name: '兆帕', symbol: 'MPa', category: 'pressure', toSI: (v) => v * 1000000, fromSI: (v) => v / 1000000 },
  { name: '巴', symbol: 'bar', category: 'pressure', toSI: (v) => v * 100000, fromSI: (v) => v / 100000 },
  { name: '米水柱', symbol: 'mH2O', category: 'pressure', toSI: (v) => v * 9806.65, fromSI: (v) => v / 9806.65 },
  { name: '公斤力/平方厘米', symbol: 'kgf/cm²', category: 'pressure', toSI: (v) => v * 98066.5, fromSI: (v) => v / 98066.5 },
  { name: '磅力/平方英寸', symbol: 'psi', category: 'pressure', toSI: (v) => v * 6894.757, fromSI: (v) => v / 6894.757 },

  { name: '立方米/秒', symbol: 'm³/s', category: 'flow', toSI: (v) => v, fromSI: (v) => v },
  { name: '立方米/时', symbol: 'm³/h', category: 'flow', toSI: (v) => v / 3600, fromSI: (v) => v * 3600 },
  { name: '升/秒', symbol: 'L/s', category: 'flow', toSI: (v) => v / 1000, fromSI: (v) => v * 1000 },
  { name: '升/分', symbol: 'L/min', category: 'flow', toSI: (v) => v / 60000, fromSI: (v) => v * 60000 },
  { name: '加仑/分(美)', symbol: 'gpm', category: 'flow', toSI: (v) => v * 3.785411784 / 60000, fromSI: (v) => v / 3.785411784 * 60000 },

  { name: '摄氏度', symbol: '°C', category: 'temperature', toSI: (v) => v + 273.15, fromSI: (v) => v - 273.15 },
  { name: '华氏度', symbol: '°F', category: 'temperature', toSI: (v) => (v - 32) * 5 / 9 + 273.15, fromSI: (v) => (v - 273.15) * 9 / 5 + 32 },
  { name: '开尔文', symbol: 'K', category: 'temperature', toSI: (v) => v, fromSI: (v) => v },

  { name: '米/秒', symbol: 'm/s', category: 'velocity', toSI: (v) => v, fromSI: (v) => v },
  { name: '厘米/秒', symbol: 'cm/s', category: 'velocity', toSI: (v) => v / 100, fromSI: (v) => v * 100 },
  { name: '英尺/秒', symbol: 'ft/s', category: 'velocity', toSI: (v) => v * 0.3048, fromSI: (v) => v / 0.3048 },

  { name: '米', symbol: 'm', category: 'diameter', toSI: (v) => v, fromSI: (v) => v },
  { name: '厘米', symbol: 'cm', category: 'diameter', toSI: (v) => v / 100, fromSI: (v) => v * 100 },
  { name: '毫米', symbol: 'mm', category: 'diameter', toSI: (v) => v / 1000, fromSI: (v) => v * 1000 },
  { name: '英寸', symbol: 'in', category: 'diameter', toSI: (v) => v * 0.0254, fromSI: (v) => v / 0.0254 },

  { name: '毫米', symbol: 'mm', category: 'roughness', toSI: (v) => v / 1000, fromSI: (v) => v * 1000 },
  { name: '米', symbol: 'm', category: 'roughness', toSI: (v) => v, fromSI: (v) => v },

  { name: '千克/立方米', symbol: 'kg/m³', category: 'dimensionless', toSI: (v) => v, fromSI: (v) => v },
  { name: '克/立方厘米', symbol: 'g/cm³', category: 'dimensionless', toSI: (v) => v * 1000, fromSI: (v) => v / 1000 },
]

const SI_UNITS: Record<string, string> = {
  length: 'm',
  pressure: 'Pa',
  flow: 'm³/s',
  temperature: 'K',
  velocity: 'm/s',
  diameter: 'm',
  roughness: 'm',
  dimensionless: 'kg/m³',
}

export function getUnitDef(symbol: string, category?: string): UnitDef | undefined {
  return UNITS.find((u) => {
    if (u.symbol === symbol) {
      if (category) return u.category === category
      return true
    }
    return false
  })
}

export function getAllUnits(): UnitDef[] {
  return UNITS
}

export function getSIUnit(category: string): string {
  return SI_UNITS[category] || ''
}

export function convertToSI(value: number, fromUnit: string, category?: string): UnitValidation {
  const unitDef = getUnitDef(fromUnit, category)
  if (!unitDef) {
    return {
      valid: false,
      message: `无法识别单位"${fromUnit}"，请检查输入`,
      convertedValue: null,
      fromUnit,
      toUnit: '',
      factor: null,
    }
  }
  const siUnit = SI_UNITS[unitDef.category]
  const converted = unitDef.toSI(value)
  const factor = converted / value
  return {
    valid: true,
    message: value === converted
      ? '已是标准单位，无需换算'
      : `${value} ${fromUnit} = ${converted.toExponential(4)} ${siUnit}（系数 ${factor.toExponential(4)}）`,
    convertedValue: converted,
    fromUnit,
    toUnit: siUnit,
    factor,
  }
}

export function convertFromSI(value: number, toUnit: string, category?: string): number {
  const unitDef = getUnitDef(toUnit, category)
  if (!unitDef) return value
  return unitDef.fromSI(value)
}

export function formatPressureSI(pa: number): string {
  const abs = Math.abs(pa)
  if (abs >= 1e6) return `${(pa / 1e6).toFixed(3)} MPa`
  if (abs >= 1e3) return `${(pa / 1e3).toFixed(3)} kPa`
  return `${pa.toFixed(2)} Pa`
}

export function formatFlowSI(cms: number): string {
  const abs = Math.abs(cms)
  if (abs < 0.001) return `${(cms * 60000).toFixed(2)} L/min`
  if (abs < 1) return `${(cms * 1000).toFixed(2)} L/s`
  return `${(cms * 3600).toFixed(2)} m³/h`
}

export function formatLengthSI(m: number): string {
  const abs = Math.abs(m)
  if (abs < 1) return `${(m * 1000).toFixed(2)} mm`
  if (abs < 1000) return `${m.toFixed(3)} m`
  return `${(m / 1000).toFixed(3)} km`
}

export function validateDirection(direction: string): { valid: boolean; message: string } {
  const valid = ['吸入', '排出', '进口', '出口', 'suction', 'discharge', 'inlet', 'outlet', '']
  const d = direction.trim().toLowerCase()
  if (!d) return { valid: true, message: '' }
  if (valid.some((v) => v.toLowerCase() === d)) {
    return { valid: true, message: '' }
  }
  const partial = valid.filter((v) => v.toLowerCase().includes(d) || d.includes(v.toLowerCase()))
  if (partial.length > 0) {
    return { valid: false, message: `方向"${direction}"不标准，是否指：${partial.join('、')}？` }
  }
  return { valid: false, message: `方向"${direction}"无法识别，请使用：吸入/排出/进口/出口` }
}

export function validateTimeInterval(timestamps: string[]): { valid: boolean; message: string; intervals: number[] } {
  if (timestamps.length < 2) return { valid: true, message: '', intervals: [] }
  const times = timestamps.map((t) => new Date(t).getTime()).filter((t) => !isNaN(t))
  if (times.length < 2) return { valid: true, message: '', intervals: [] }
  const intervals: number[] = []
  for (let i = 1; i < times.length; i++) {
    intervals.push((times[i] - times[i - 1]) / 1000)
  }
  const positiveIntervals = intervals.filter((iv) => iv > 0)
  if (positiveIntervals.length === 0) {
    return { valid: true, message: '所有记录为同一时刻采集', intervals }
  }
  const avg = positiveIntervals.reduce((a, b) => a + b, 0) / positiveIntervals.length
  const irregular = positiveIntervals.some((iv) => Math.abs(iv - avg) / avg > 0.5)
  if (irregular) {
    return {
      valid: false,
      message: `时间间隔不一致，平均 ${avg.toFixed(1)}s，请检查是否有缺失数据`,
      intervals,
    }
  }
  return { valid: true, message: '', intervals }
}
