import { PCA } from "ml-pca"
import type { Sample, FeatureColumn, LabelAssignment, ConflictReport } from "@/types"

export function computePCAProjection(
  featureMatrix: number[][],
  sampleIds: string[],
  datasetId: string
): Sample[] {
  if (featureMatrix.length === 0) return []

  const pca = new PCA(featureMatrix)
  const projected = pca.predict(featureMatrix)

  const xs = projected.getColumn(0)
  const ys = projected.getColumn(1)
  const zs = projected.getColumn(2)

  const normalize = (arr: number[] | Float64Array): Float64Array => {
    const values = Array.from(arr)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const result = new Float64Array(values.length)
    for (let i = 0; i < values.length; i++) {
      result[i] = ((values[i] - min) / range) * 4 - 2
    }
    return result
  }

  const nx = normalize(xs)
  const ny = normalize(ys)
  const nz = normalize(zs)

  return sampleIds.map((id, i) => ({
    id,
    datasetId,
    index: i,
    projectedX: nx[i],
    projectedY: ny[i],
    projectedZ: nz[i],
    targetX: nx[i],
    targetY: ny[i],
    targetZ: nz[i],
    isOutlier: false,
    outlierScore: 0,
  }))
}

export function computeAxisProjection(
  featureMatrix: number[][],
  sampleIds: string[],
  datasetId: string,
  xCol: number,
  yCol: number,
  zCol: number
): Sample[] {
  if (featureMatrix.length === 0) return []

  const normalize = (arr: number[]) => {
    const min = Math.min(...arr)
    const max = Math.max(...arr)
    const range = max - min || 1
    return arr.map((v) => ((v - min) / range) * 4 - 2)
  }

  const xVals = normalize(featureMatrix.map((r) => r[xCol] ?? 0))
  const yVals = normalize(featureMatrix.map((r) => r[yCol] ?? 0))
  const zVals = normalize(featureMatrix.map((r) => r[zCol] ?? 0))

  return sampleIds.map((id, i) => ({
    id,
    datasetId,
    index: i,
    projectedX: xVals[i],
    projectedY: yVals[i],
    projectedZ: zVals[i],
    targetX: xVals[i],
    targetY: yVals[i],
    targetZ: zVals[i],
    isOutlier: false,
    outlierScore: 0,
  }))
}

export function computePCAVarianceRatios(featureMatrix: number[][]): number[] {
  if (featureMatrix.length === 0 || featureMatrix[0].length === 0) return []
  const pca = new PCA(featureMatrix)
  return Array.from(pca.getExplainedVariance())
}

export function detectOutliers(
  samples: Sample[],
  labels: LabelAssignment[],
  threshold: number
): Map<string, number> {
  const clusterMap = new Map<number, { sum: number[]; count: number }>()
  const labelMap = new Map<string, number>()

  for (const l of labels) {
    labelMap.set(l.sampleId, l.clusterId)
  }

  for (const s of samples) {
    const cid = labelMap.get(s.id)
    if (cid === undefined) continue
    const existing = clusterMap.get(cid)
    if (existing) {
      existing.sum[0] += s.targetX
      existing.sum[1] += s.targetY
      existing.sum[2] += s.targetZ
      existing.count++
    } else {
      clusterMap.set(cid, { sum: [s.targetX, s.targetY, s.targetZ], count: 1 })
    }
  }

  const centroids = new Map<number, number[]>()
  for (const [cid, data] of clusterMap) {
    centroids.set(cid, [data.sum[0] / data.count, data.sum[1] / data.count, data.sum[2] / data.count])
  }

  const distances = new Map<string, number>()
  const distValues: number[] = []

  for (const s of samples) {
    const cid = labelMap.get(s.id)
    if (cid === undefined) continue
    const c = centroids.get(cid)
    if (!c) continue
    const dx = s.targetX - c[0]
    const dy = s.targetY - c[1]
    const dz = s.targetZ - c[2]
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    distances.set(s.id, dist)
    distValues.push(dist)
  }

  if (distValues.length === 0) return distances

  const mean = distValues.reduce((a, b) => a + b, 0) / distValues.length
  const std = Math.sqrt(distValues.reduce((a, b) => a + (b - mean) ** 2, 0) / distValues.length) || 1

  const result = new Map<string, number>()
  for (const [id, dist] of distances) {
    const zScore = Math.abs(dist - mean) / std
    if (zScore > threshold) {
      result.set(id, zScore)
    }
  }

  return result
}

export function detectLabelConflicts(
  existingLabels: LabelAssignment[],
  newLabels: LabelAssignment[],
  newColumnName: string,
  existingColumnName: string
): ConflictReport | null {
  const existingMap = new Map<string, LabelAssignment>()
  for (const l of existingLabels) {
    existingMap.set(l.sampleId, l)
  }

  const conflicts: { sampleId: string; existingCluster: number; newCluster: number }[] = []

  for (const nl of newLabels) {
    const el = existingMap.get(nl.sampleId)
    if (el && el.clusterId !== nl.clusterId && !el.manuallyModified) {
      conflicts.push({
        sampleId: nl.sampleId,
        existingCluster: el.clusterId,
        newCluster: nl.clusterId,
      })
    }
  }

  if (conflicts.length === 0) return null

  return {
    id: `conflict_${Date.now()}`,
    batchId: "",
    conflictType: "label_mismatch",
    affectedSampleIds: conflicts.map((c) => c.sampleId),
    affectedColumns: [existingColumnName, newColumnName],
    detail: `标签列"${newColumnName}"与已有"${existingColumnName}"在样本${conflicts.map((c) => `#${c.sampleId}`).join(", ")}上冲突（原簇${conflicts[0].existingCluster}→新簇${conflicts[0].newCluster}等），请确认覆盖范围`,
    resolved: false,
  }
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string | number | null>[] } {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
  const rows: Record<string, string | number | null>[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
    const row: Record<string, string | number | null> = {}
    for (let j = 0; j < headers.length; j++) {
      const raw = vals[j] ?? null
      if (raw === null || raw === "" || raw === "NA" || raw === "null" || raw === "NaN") {
        row[headers[j]] = null
      } else {
        const num = Number(raw)
        row[headers[j]] = isNaN(num) ? raw : num
      }
    }
    rows.push(row)
  }

  return { headers, rows }
}

export function generateDemoData(): {
  headers: string[]
  rows: Record<string, number | string | null>[]
} {
  const headers = ["id", "income", "age", "education", "spending", "cluster"]
  const rows: Record<string, number | string | null>[] = []
  const rand = (min: number, max: number) => min + Math.random() * (max - min)
  const randInt = (min: number, max: number) => Math.floor(rand(min, max))

  for (let i = 0; i < 200; i++) {
    const cluster = randInt(0, 4)
    const baseIncome = [35, 60, 85, 25, 95][cluster]
    const baseAge = [28, 42, 55, 22, 48][cluster]
    const baseEdu = [12, 16, 20, 10, 18][cluster]
    const baseSpend = [20, 45, 65, 15, 70][cluster]

    const isOutlier = Math.random() < 0.05
    const outlierShift = isOutlier ? (Math.random() > 0.5 ? 1 : -1) * rand(20, 40) : 0

    rows.push({
      id: `sample_${i}`,
      income: Math.max(5, baseIncome + rand(-8, 8) + outlierShift),
      age: Math.max(18, baseAge + rand(-6, 6) + outlierShift * 0.5),
      education: Math.max(6, baseEdu + rand(-2, 2) + outlierShift * 0.3),
      spending: Math.max(5, baseSpend + rand(-10, 10) + outlierShift),
      cluster,
    })
  }

  return { headers, rows }
}
