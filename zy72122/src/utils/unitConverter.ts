import { UNIT_ALIASES, UNIT_CONVERSION } from '@/types'

export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  return UNIT_ALIASES[trimmed] || raw.trim()
}

export function convertValue(
  value: number,
  fromUnit: string,
  toUnit: string,
  category: 'displacement' | 'force' | 'stiffness'
): number | null {
  const normalizedFrom = normalizeUnit(fromUnit)
  const normalizedTo = normalizeUnit(toUnit)

  if (normalizedFrom === normalizedTo) return value

  const convTable = UNIT_CONVERSION[category]
  if (!convTable) return null

  const fromBase = convTable[normalizedFrom]
  const toBase = convTable[normalizedTo]

  if (fromBase === undefined || toBase === undefined) return null

  const valueInBase = value * fromBase
  return valueInBase / toBase
}

export function detectMixedUnits(units: string[]): { mixed: boolean; details: string } {
  const normalized = units.map(normalizeUnit)
  const unique = new Set(normalized)

  if (unique.size <= 1) return { mixed: false, details: '' }

  return {
    mixed: true,
    details: `检测到混用单位：${[...unique].join('、')}，建议统一`,
  }
}

export function parseRawValue(raw: string): {
  value: number
  unit: string
  direction: '+' | '-'
} | null {
  const match = raw.trim().match(/^([+-]?)([\d.]+)\s*(.+)$/)

  if (!match) return null

  const dir = match[1] === '-' ? '-' : '+'
  const value = parseFloat(match[2])
  const unit = match[3].trim()

  if (isNaN(value)) return null

  return { value: dir === '-' ? -Math.abs(value) : value, unit, direction: dir }
}

export function parseBatchInput(text: string): {
  timestamp: string
  springStiffness: number
  stiffnessUnit: string
  displacement: number
  displacementUnit: string
  force: number
  forceUnit: string
  direction: '+' | '-'
}[] {
  const lines = text.split('\n').filter((l) => l.trim())
  const results: ReturnType<typeof parseBatchInput> = []

  for (const line of lines) {
    const parts = line.split(/[,\t;，]/).map((p) => p.trim())
    if (parts.length < 7) continue

    const timestamp = parts[0]
    const stiffnessParsed = parseRawValue(parts[1])
    const displacementParsed = parseRawValue(parts[2])
    const forceParsed = parseRawValue(parts[3])

    if (!stiffnessParsed || !displacementParsed || !forceParsed) continue

    results.push({
      timestamp,
      springStiffness: Math.abs(stiffnessParsed.value),
      stiffnessUnit: stiffnessParsed.unit,
      displacement: displacementParsed.value,
      displacementUnit: displacementParsed.unit,
      force: forceParsed.value,
      forceUnit: forceParsed.unit,
      direction: forceParsed.direction,
    })
  }

  return results
}
