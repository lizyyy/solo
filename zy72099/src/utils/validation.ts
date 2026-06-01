import type { ExhibitPoint, ValidationResult, ValidationCategory } from '@/types'

const FT_TO_M = 0.3048

export function convertToMeters(point: ExhibitPoint): ExhibitPoint {
  if (point.unit === 'ft') {
    return {
      ...point,
      x: point.x !== null ? Math.round(point.x * FT_TO_M * 100) / 100 : null,
      y: point.y !== null ? Math.round(point.y * FT_TO_M * 100) / 100 : null,
      unit: 'm' as const,
    }
  }
  return point
}

export function findDuplicates(points: ExhibitPoint[]): Map<string, string[]> {
  const coordMap = new Map<string, string[]>()
  for (const p of points) {
    if (p.x !== null && p.y !== null) {
      const key = `${p.x},${p.y},${p.floor}`
      const existing = coordMap.get(key) || []
      existing.push(p.id)
      coordMap.set(key, existing)
    }
  }
  const duplicates = new Map<string, string[]>()
  for (const [key, ids] of coordMap) {
    if (ids.length > 1) {
      duplicates.set(key, ids)
    }
  }
  return duplicates
}

export function validatePoints(points: ExhibitPoint[]): ValidationResult[] {
  const duplicates = findDuplicates(points)
  const duplicateIds = new Set<string>()
  for (const ids of duplicates.values()) {
    for (const id of ids) {
      duplicateIds.add(id)
    }
  }

  const majorityUnit = points.reduce(
    (acc, p) => {
      acc[p.unit] = (acc[p.unit] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const dominantUnit = (Object.entries(majorityUnit).sort((a, b) => b[1] - a[1])[0]?.[0] || 'm') as 'm' | 'ft'

  return points.map((point) => {
    const reasons: string[] = []
    let status: ValidationResult['status'] = 'valid'

    if (point.x === null || point.y === null) {
      reasons.push(`坐标不完整：x=${point.x ?? '空'}, y=${point.y ?? '空'}，无法计算距离`)
      status = 'uncalculable'
    }

    if (duplicateIds.has(point.id)) {
      const dupKey = `${point.x},${point.y},${point.floor}`
      const dupGroup = duplicates.get(dupKey) || []
      const others = dupGroup.filter((id) => id !== point.id)
      reasons.push(`与展点 ${others.join(', ')} 坐标完全重复 (${point.x}, ${point.y})，将在优化中合并`)
      if (status === 'valid') status = 'warning'
    }

    if (point.unit !== dominantUnit) {
      reasons.push(`单位为 ${point.unit}，与其余数据（${dominantUnit}）不一致，已自动转换为 ${dominantUnit}`)
      if (status === 'valid') status = 'warning'
    }

    if (point.estimatedStayMinutes !== null && point.estimatedStayMinutes > 120) {
      reasons.push(
        `预计停留 ${point.estimatedStayMinutes} 分钟（${(point.estimatedStayMinutes / 60).toFixed(1)} 小时），远超常规值，疑似录入错误或异常停留，优化结果可能偏移`,
      )
      if (status === 'valid') status = 'warning'
    }

    return { pointId: point.id, status, reasons }
  })
}

export function categorizeValidation(
  results: ValidationResult[],
): Record<ValidationCategory, ValidationResult[]> {
  const categories: Record<ValidationCategory, ValidationResult[]> = {
    null_value: [],
    duplicate: [],
    unit_mismatch: [],
    suspicious: [],
    none: [],
  }

  for (const result of results) {
    if (result.status === 'valid') {
      categories.none.push(result)
      continue
    }
    const point = result.pointId
    for (const reason of result.reasons) {
      if (reason.includes('坐标不完整')) {
        categories.null_value.push(result)
        break
      }
      if (reason.includes('坐标完全重复')) {
        categories.duplicate.push(result)
        break
      }
      if (reason.includes('单位为')) {
        categories.unit_mismatch.push(result)
        break
      }
      if (reason.includes('远超常规值')) {
        categories.suspicious.push(result)
        break
      }
    }
  }

  return categories
}
