import type { ForceUnit } from "@/types"

const CONVERSION_TO_KN: Record<ForceUnit, number> = {
  kN: 1,
  N: 0.001,
  lbf: 0.00444822,
  kgf: 0.00980665,
}

export function convertToKN(value: number, unit: ForceUnit): number {
  return value * CONVERSION_TO_KN[unit]
}

export function formatForce(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)} kN`
}

export function getUnitLabel(unit: ForceUnit): string {
  const labels: Record<ForceUnit, string> = {
    kN: "千牛 (kN)",
    N: "牛顿 (N)",
    lbf: "磅力 (lbf)",
    kgf: "千克力 (kgf)",
  }
  return labels[unit]
}

export function interpolateGap(
  before: number | null,
  after: number | null,
  beforeIndex: number,
  afterIndex: number,
  currentIndex: number
): number | null {
  if (before === null || after === null) return null
  const ratio = (currentIndex - beforeIndex) / (afterIndex - beforeIndex)
  return before + (after - before) * ratio
}

export function fillGaps(values: (number | null)[]): (number | null)[] {
  const result = [...values]
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      let beforeIdx = -1
      let afterIdx = -1
      for (let j = i - 1; j >= 0; j--) {
        if (result[j] !== null) { beforeIdx = j; break }
      }
      for (let j = i + 1; j < result.length; j++) {
        if (result[j] !== null) { afterIdx = j; break }
      }
      if (beforeIdx >= 0 && afterIdx >= 0) {
        result[i] = interpolateGap(
          result[beforeIdx], result[afterIdx],
          beforeIdx, afterIdx, i
        )
      }
    }
  }
  return result
}
