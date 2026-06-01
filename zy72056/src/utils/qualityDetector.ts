import type { StationPoint, QualityFlag, QualityFlagType } from "@/data/types"
import { isOutOfBounds } from "@/data/mockStation"

function similarity(a: string, b: string): number {
  if (a === b) return 1
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1
  const editDist = levenshtein(longer, shorter)
  return (longer.length - editDist) / longer.length
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

export interface QualityIssue {
  pointId: string
  flagType: QualityFlagType
  description: string
  relatedIds?: string[]
}

export function detectQualityIssues(points: StationPoint[]): QualityIssue[] {
  const issues: QualityIssue[] = []

  for (const p of points) {
    if (isOutOfBounds({ x: p.x, y: p.y, floor: p.floor })) {
      if (!p.qualityFlags.some(f => f.type === "offset")) {
        issues.push({ pointId: p.id, flagType: "offset", description: `坐标(${p.x},${p.y})超出${p.floor}站厅边界` })
      }
    }

    if (!p.photo || p.photo.trim() === "") {
      if (!p.qualityFlags.some(f => f.type === "missing_photo")) {
        issues.push({ pointId: p.id, flagType: "missing_photo", description: "照片缺失" })
      }
    }
  }

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (points[i].floor !== points[j].floor) continue
      if (points[i].qualityFlags.some(f => f.type === "duplicate") && points[j].qualityFlags.some(f => f.type === "duplicate")) continue
      const sim = similarity(points[i].name, points[j].name)
      if (sim > 0.8 && sim < 1.0) {
        if (!points[i].qualityFlags.some(f => f.type === "duplicate" && f.relatedIds?.includes(points[j].id))) {
          issues.push({
            pointId: points[i].id,
            flagType: "duplicate",
            description: `与${points[j].id}"${points[j].name}"名称相似度${(sim * 100).toFixed(0)}%`,
            relatedIds: [points[j].id],
          })
        }
      }
    }
  }

  const nameFloorMap = new Map<string, string[]>()
  for (const p of points) {
    const existing = nameFloorMap.get(p.name) || []
    if (!existing.includes(p.floor)) existing.push(p.floor)
    nameFloorMap.set(p.name, existing)
  }
  for (const [name, floors] of nameFloorMap) {
    if (floors.length > 1) {
      const crossFloorPoints = points.filter(p => p.name === name)
      for (const p of crossFloorPoints) {
        if (!p.qualityFlags.some(f => f.type === "cross_floor")) {
          issues.push({
            pointId: p.id,
            flagType: "cross_floor",
            description: `"${name}"出现在多个楼层: ${floors.join(", ")}`,
            relatedIds: crossFloorPoints.map(cp => cp.id).filter(id => id !== p.id),
          })
        }
      }
    }
  }

  return issues
}

export function getQualityFlagColor(flag: QualityFlag): string {
  if (flag.resolved) return "#22C55E"
  switch (flag.type) {
    case "offset": return "#F0A500"
    case "duplicate": return "#F0A500"
    case "missing_photo": return "#888888"
    case "cross_floor": return "#FF4444"
    default: return "#888888"
  }
}
