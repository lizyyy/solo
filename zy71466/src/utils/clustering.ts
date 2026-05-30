import type { TensileCurve, ClusterResult, ClusterExplanation } from '@/types'

function computePCA(data: number[][], nComponents: number): { coords: number[][]; explainedVariance: number[] } {
  const n = data.length
  const p = data[0].length

  const mean = Array(p).fill(0)
  for (let j = 0; j < p; j++) {
    for (let i = 0; i < n; i++) mean[j] += data[i][j]
    mean[j] /= n
  }

  const centered = data.map((row) => row.map((v, j) => v - mean[j]))

  const cov = Array.from({ length: p }, () => Array(p).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = j; k < p; k++) {
        cov[j][k] += centered[i][j] * centered[i][k]
        if (j !== k) cov[k][j] = cov[j][k]
      }
    }
  }
  for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) cov[j][k] /= n - 1

  const components = powerIteration(cov, nComponents, p)

  const coords = centered.map((row) =>
    components.map((comp) => row.reduce((s, v, j) => s + v * comp[j], 0))
  )

  const totalVar = cov.reduce((s, row) => s + row.reduce((ss, v) => ss + Math.abs(v), 0), 0)
  const explainedVariance = components.map((comp) => {
    const proj = centered.map((row) => row.reduce((s, v, j) => s + v * comp[j], 0))
    const v = proj.reduce((s, val) => s + val * val, 0) / (n - 1)
    return v / (totalVar / p) || 0
  })

  return { coords, explainedVariance }
}

function powerIteration(matrix: number[][], nComponents: number, p: number): number[][] {
  const components: number[][] = []
  const deflated = matrix.map((r) => [...r])

  for (let c = 0; c < nComponents; c++) {
    let vec = Array.from({ length: p }, () => Math.random() - 0.5)
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
    vec = vec.map((v) => v / norm)

    for (let iter = 0; iter < 200; iter++) {
      const newVec = Array(p).fill(0)
      for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) newVec[i] += deflated[i][j] * vec[j]
      const newNorm = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0))
      if (newNorm < 1e-12) break
      vec = newVec.map((v) => v / newNorm)
    }

    const eigenvalue = vec.reduce((s, vi, i) => s + deflated[i].reduce((ss, aij, j) => ss + aij * vi * vec[j], 0), 0)

    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) deflated[i][j] -= eigenvalue * vec[i] * vec[j]

    components.push(vec)
  }

  return components
}

function kMeans(data: number[][], k: number, maxIter = 100): { labels: number[]; centroids: number[][] } {
  const n = data.length
  const p = data[0].length

  const indices = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }

  let centroids = indices.slice(0, k).map((idx) => [...data[idx]])
  let labels = Array(n).fill(0)

  for (let iter = 0; iter < maxIter; iter++) {
    const newLabels = data.map((point) => {
      let minDist = Infinity
      let minIdx = 0
      centroids.forEach((c, idx) => {
        const dist = point.reduce((s, v, j) => s + (v - c[j]) ** 2, 0)
        if (dist < minDist) {
          minDist = dist
          minIdx = idx
        }
      })
      return minIdx
    })

    const changed = newLabels.some((l, i) => l !== labels[i])
    labels = newLabels
    if (!changed) break

    centroids = Array.from({ length: k }, (_, ci) => {
      const members = data.filter((_, i) => labels[i] === ci)
      if (members.length === 0) return centroids[ci]
      return Array(p).fill(0).map((_, j) => members.reduce((s, m) => s + m[j], 0) / members.length)
    })
  }

  return { labels, centroids }
}

function computeSilhouette(data: number[][], labels: number[]): number {
  const n = data.length
  const uniqueLabels = [...new Set(labels)]
  if (uniqueLabels.length < 2 || uniqueLabels.length >= n) return 0

  const silhouetteValues: number[] = []

  for (let i = 0; i < n; i++) {
    const myLabel = labels[i]
    const myCluster = data.filter((_, j) => labels[j] === myLabel)
    if (myCluster.length <= 1) {
      silhouetteValues.push(0)
      continue
    }

    const a = myCluster.reduce((s, p) => s + Math.sqrt(data[i].reduce((ss, v, d) => ss + (v - p[d]) ** 2, 0)), 0) / (myCluster.length - 1)

    let minB = Infinity
    for (const label of uniqueLabels) {
      if (label === myLabel) continue
      const otherCluster = data.filter((_, j) => labels[j] === label)
      if (otherCluster.length === 0) continue
      const b = otherCluster.reduce((s, p) => s + Math.sqrt(data[i].reduce((ss, v, d) => ss + (v - p[d]) ** 2, 0)), 0) / otherCluster.length
      if (b < minB) minB = b
    }

    silhouetteValues.push(minB === Infinity ? 0 : (minB - a) / Math.max(a, minB))
  }

  return silhouetteValues.reduce((s, v) => s + v, 0) / n
}

function buildExplanations(curves: TensileCurve[], labels: number[], k: number): ClusterExplanation[] {
  const explanations: ClusterExplanation[] = []

  for (let ci = 0; ci < k; ci++) {
    const members = curves.filter((_, i) => labels[i] === ci)
    if (members.length === 0) continue

    const count = members.length
    const avgFractureStrength = members.reduce((s, c) => {
      const maxStress = Math.max(...c.stress)
      return s + maxStress
    }, 0) / count

    const fractureCounts: Record<string, number> = {}
    const batchCounts: Record<string, number> = {}
    let anomalyCount = 0

    members.forEach((c) => {
      const ft = c.fractureType || '未知'
      fractureCounts[ft] = (fractureCounts[ft] || 0) + 1
      batchCounts[c.batchNo] = (batchCounts[c.batchNo] || 0) + 1
      if (c.isAnomaly) anomalyCount++
    })

    const dominantFractureType = Object.entries(fractureCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知'
    const dominantBatch = Object.entries(batchCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知'
    const anomalyRatio = anomalyCount / count

    const descriptions: string[] = []
    if (anomalyRatio > 0.5) descriptions.push('高异常比例簇')
    else if (anomalyRatio > 0.2) descriptions.push('含部分异常')
    else descriptions.push('以正常曲线为主')

    if (dominantFractureType !== '未知') descriptions.push(`以${dominantFractureType}断裂为主`)
    if (Object.keys(batchCounts).length === 1) descriptions.push('单一批次')
    else if (Object.keys(batchCounts).length > 3) descriptions.push('批次混杂')

    explanations.push({
      clusterId: ci,
      count,
      avgFractureStrength: Math.round(avgFractureStrength * 100) / 100,
      dominantFractureType,
      dominantBatch,
      anomalyRatio: Math.round(anomalyRatio * 1000) / 1000,
      description: descriptions.join('，'),
    })
  }

  return explanations
}

export function performClustering(curves: TensileCurve[], k: number): ClusterResult {
  const alignedData = curves.map((c) => c.alignedStress || c.stress)

  const { coords: pcaCoords } = computePCA(alignedData, 2)

  const { labels, centroids } = kMeans(pcaCoords, k)
  const silhouette = computeSilhouette(pcaCoords, labels)
  const explanations = buildExplanations(curves, labels, k)

  return {
    k,
    labels,
    centroids,
    pcaCoords,
    silhouette: Math.round(silhouette * 1000) / 1000,
    explanations,
  }
}
