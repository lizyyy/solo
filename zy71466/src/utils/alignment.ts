export function linearInterpolation(x: number[], y: number[], targetLength: number): { x: number[]; y: number[] } {
  if (x.length === 0 || y.length === 0) return { x: [], y: [] }
  if (x.length === 1) {
    return {
      x: Array(targetLength).fill(x[0]),
      y: Array(targetLength).fill(y[0]),
    }
  }

  const xMin = x[0]
  const xMax = x[x.length - 1]
  const step = (xMax - xMin) / (targetLength - 1)
  const newX: number[] = []
  const newY: number[] = []

  for (let i = 0; i < targetLength; i++) {
    const xi = xMin + step * i
    newX.push(xi)

    let lo = 0
    let hi = x.length - 1
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2)
      if (x[mid] <= xi) lo = mid
      else hi = mid
    }

    if (x[hi] === x[lo]) {
      newY.push(y[lo])
    } else {
      const t = (xi - x[lo]) / (x[hi] - x[lo])
      newY.push(y[lo] + t * (y[hi] - y[lo]))
    }
  }

  return { x: newX, y: newY }
}

export function dtwDistance(a: number[], b: number[]): number {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity))
  dp[0][0] = 0

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = (a[i - 1] - b[j - 1]) ** 2
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }

  return Math.sqrt(dp[n][m])
}

export function alignCurveDTW(strain: number[], stress: number[], targetLength: number): { strain: number[]; stress: number[] } {
  if (strain.length <= targetLength) {
    const result = linearInterpolation(strain, stress, targetLength)
    return { strain: result.x, stress: result.y }
  }

  const indices: number[] = []
  const step = (strain.length - 1) / (targetLength - 1)
  for (let i = 0; i < targetLength; i++) {
    indices.push(Math.round(step * i))
  }

  return {
    strain: indices.map((i) => strain[i]),
    stress: indices.map((i) => stress[i]),
  }
}

export function alignCurves(
  curves: { strain: number[]; stress: number[] }[],
  mode: 'interpolation' | 'dtw',
  targetLength: number
): { alignedStrain: number[]; alignedStress: number[] }[] {
  return curves.map((c) => {
    if (mode === 'dtw') {
      const result = alignCurveDTW(c.strain, c.stress, targetLength)
      return { alignedStrain: result.strain, alignedStress: result.stress }
    }
    const result = linearInterpolation(c.strain, c.stress, targetLength)
    return { alignedStrain: result.x, alignedStress: result.y }
  })
}
