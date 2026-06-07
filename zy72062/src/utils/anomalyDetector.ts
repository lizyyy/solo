import type { Entity, Anomaly } from '../types'

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  )
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function createAnomaly(
  entityId: string,
  type: Anomaly['type'],
  description: string,
  sourceFile: string
): Anomaly {
  return {
    id: crypto.randomUUID(),
    entityId,
    type,
    description,
    sourceFile,
    detectedAt: new Date().toISOString(),
    status: 'pending',
  }
}

export function detectCoordinateOffset(
  entities: Entity[],
  sourceFile: string
): Anomaly[] {
  const anomalies: Anomaly[] = []
  const groups = new Map<string, Entity[]>()

  for (const e of entities) {
    const list = groups.get(e.coordinateSystem) ?? []
    list.push(e)
    groups.set(e.coordinateSystem, list)
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue

    const avgX = group.reduce((s, e) => s + e.x, 0) / group.length
    const avgY = group.reduce((s, e) => s + e.y, 0) / group.length

    for (const e of group) {
      const dist = Math.sqrt((e.x - avgX) ** 2 + (e.y - avgY) ** 2)
      if (dist > 500) {
        anomalies.push(
          createAnomaly(
            e.id,
            'coordinate_offset',
            `实体「${e.name}」在坐标系 ${e.coordinateSystem} 中偏离聚类中心 ${dist.toFixed(1)} 单位（阈值 500），坐标 (${e.x}, ${e.y})，聚类中心 (${avgX.toFixed(1)}, ${avgY.toFixed(1)})`,
            sourceFile
          )
        )
      }
    }
  }

  return anomalies
}

export function detectDuplicateNames(
  entities: Entity[],
  sourceFile: string
): Anomaly[] {
  const anomalies: Anomaly[] = []
  const reported = new Set<string>()

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i]
      const b = entities[j]
      const key = [a.id, b.id].sort().join('|')
      if (reported.has(key)) continue

      const dist = levenshtein(a.name, b.name)
      const contains =
        (a.name.includes(b.name) && Math.abs(a.name.length - b.name.length) >= 2) ||
        (b.name.includes(a.name) && Math.abs(a.name.length - b.name.length) >= 2)

      const exactOrNear = dist <= 1
      const isDuplicate = exactOrNear || contains

      if (isDuplicate) {
        reported.add(key)
        anomalies.push(
          createAnomaly(
            a.id,
            'duplicate_name',
            `实体「${a.name}」与「${b.name}」可能为同一实体（编辑距离: ${dist}，包含关系: ${contains}）`,
            sourceFile
          )
        )
      }
    }
  }

  return anomalies
}

export function detectMissingPhotos(
  entities: Entity[],
  sourceFile: string
): Anomaly[] {
  return entities
    .filter((e) => e.photoUrl === null)
    .map((e) =>
      createAnomaly(
        e.id,
        'missing_photo',
        `实体「${e.name}」缺少照片信息`,
        sourceFile
      )
    )
}

export function detectCrossFloor(
  entities: Entity[],
  sourceFile: string
): Anomaly[] {
  const anomalies: Anomaly[] = []
  const nameFloorMap = new Map<string, { entityId: string; floor: number }[]>()

  for (const e of entities) {
    const allNames = [e.name, ...e.alias]
    for (const name of allNames) {
      const list = nameFloorMap.get(name) ?? []
      list.push({ entityId: e.id, floor: e.floor })
      nameFloorMap.set(name, list)
    }
  }

  const reported = new Set<string>()

  for (const [, entries] of nameFloorMap) {
    const floors = new Set(entries.map((e) => e.floor))
    if (floors.size > 1) {
      for (const entry of entries) {
        const key = `${entry.entityId}-cross_floor`
        if (reported.has(key)) continue
        reported.add(key)

        const entity = entities.find((e) => e.id === entry.entityId)
        if (!entity) continue

        anomalies.push(
          createAnomaly(
            entry.entityId,
            'cross_floor',
            `实体「${entity.name}」在多个楼层出现: ${Array.from(floors).join(', ')}`,
            sourceFile
          )
        )
      }
    }
  }

  return anomalies
}

export function runAllDetections(
  entities: Entity[],
  sourceFile: string
): Anomaly[] {
  return [
    ...detectCoordinateOffset(entities, sourceFile),
    ...detectDuplicateNames(entities, sourceFile),
    ...detectMissingPhotos(entities, sourceFile),
    ...detectCrossFloor(entities, sourceFile),
  ]
}
