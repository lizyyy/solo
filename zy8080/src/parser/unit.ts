import { Dimension, Unit } from '../types'

const MM_PER_INCH = 25.4
const PT_PER_INCH = 72

export function parseDimension(value: string | number, defaultUnit: Unit = 'mm'): Dimension {
  if (typeof value === 'number') {
    return { value, unit: defaultUnit }
  }
  
  const trimmed = value.trim().toLowerCase()
  const match = trimmed.match(/^([\d.]+)\s*([a-z]+)$/)
  
  if (match) {
    const numValue = parseFloat(match[1])
    const unit = match[2] as Unit
    if (isValidUnit(unit)) {
      return { value: numValue, unit }
    }
  }
  
  const numValue = parseFloat(trimmed)
  if (!isNaN(numValue)) {
    return { value: numValue, unit: defaultUnit }
  }
  
  throw new Error(`Invalid dimension: ${value}`)
}

export function isValidUnit(unit: string): unit is Unit {
  return ['mm', 'in', 'pt'].includes(unit)
}

export function toMM(dim: Dimension): number {
  switch (dim.unit) {
    case 'mm':
      return dim.value
    case 'in':
      return dim.value * MM_PER_INCH
    case 'pt':
      return (dim.value / PT_PER_INCH) * MM_PER_INCH
    default:
      return dim.value
  }
}

export function toInch(dim: Dimension): number {
  switch (dim.unit) {
    case 'mm':
      return dim.value / MM_PER_INCH
    case 'in':
      return dim.value
    case 'pt':
      return dim.value / PT_PER_INCH
    default:
      return dim.value
  }
}

export function toPoints(dim: Dimension): number {
  switch (dim.unit) {
    case 'mm':
      return (dim.value / MM_PER_INCH) * PT_PER_INCH
    case 'in':
      return dim.value * PT_PER_INCH
    case 'pt':
      return dim.value
    default:
      return dim.value
  }
}

export function formatDimension(dim: Dimension, unit?: Unit): string {
  const targetUnit = unit || dim.unit
  let value: number
  
  switch (targetUnit) {
    case 'mm':
      value = toMM(dim)
      break
    case 'in':
      value = toInch(dim)
      break
    case 'pt':
      value = toPoints(dim)
      break
    default:
      value = dim.value
  }
  
  const formatted = value.toFixed(value < 10 ? 2 : 1)
  return `${formatted}${targetUnit}`
}
