import { Matrix, SVD as MLMatrixSVD } from 'ml-matrix'
import type { SVDResult, WeightEntry, BoundaryRecord } from '@/types'

export function computeSVD(
  numericMatrix: number[][],
  weights: WeightEntry[],
  boundaryRecords: BoundaryRecord[]
): SVDResult | null {
  if (numericMatrix.length === 0 || numericMatrix[0].length === 0) return null

  const cols = numericMatrix[0].length
  const weightArr = new Array(cols).fill(1)
  for (const w of weights) {
    const idx = weights.indexOf(w)
    if (idx >= 0 && idx < cols) {
      weightArr[idx] = w.isComplete ? w.weight : 1
    }
  }

  const weighted = numericMatrix.map(row =>
    row.map((val, j) => val * weightArr[j])
  )

  try {
    const mat = new Matrix(weighted)
    const svd = new MLMatrixSVD(mat, { computeLeftSingularVectors: true, computeRightSingularVectors: true })

    const singularValues = Array.from(svd.diagonal)
    const totalVariance = singularValues.reduce((s, v) => s + v * v, 0)
    const explainedVarianceRatio = singularValues.map(s => totalVariance > 0 ? (s * s) / totalVariance : 0)

    const U = svd.leftSingularVectors.to2DArray()
    const k = Math.min(3, singularValues.length)
    const projectedData = U.map(row => {
      const coords: [number, number, number] = [0, 0, 0]
      for (let i = 0; i < k; i++) {
        coords[i] = row[i] * singularValues[i]
      }
      return coords
    })

    const anomalyPointIndices: number[] = []
    boundaryRecords.forEach(record => {
      if (record.status !== 'resolved') {
        if (!anomalyPointIndices.includes(record.rowIndex)) {
          anomalyPointIndices.push(record.rowIndex)
        }
      }
    })

    return {
      id: `svd-${Date.now()}`,
      projectedData,
      singularValues,
      explainedVarianceRatio,
      anomalyPointIndices,
    }
  } catch {
    return null
  }
}
