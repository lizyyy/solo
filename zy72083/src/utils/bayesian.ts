import type { PriorParams, Observation, PosteriorResult, Warning, BoundaryConfig, SupplementDiff, ChangedField } from './types'

const DEFAULT_BOUNDARY: BoundaryConfig = {
  maxAlpha: 10000,
  maxBeta: 10000,
  maxMu: 1,
  maxSigma2: 1,
  minConversions: 0,
  maxConversions: 1000000,
  outlierStdThreshold: 3,
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function betaPdf(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0
  const logBeta = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta)
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta)
}

function logGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  z -= 1
  const g = 0.5772156649015329
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  let x = c[0]
  for (let i = 1; i < 9; i++) {
    x += c[i] / (z + i)
  }
  const t = z + g + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

function normalPdf(x: number, mu: number, sigma2: number): number {
  const sigma = Math.sqrt(sigma2)
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2))
}

function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta)
}

function betaVar(alpha: number, beta: number): number {
  return (alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1))
}

function betaCredibleInterval(alpha: number, beta: number, level: number = 0.95): [number, number] {
  const lower = betaInv((1 - level) / 2, alpha, beta)
  const upper = betaInv((1 + level) / 2, alpha, beta)
  return [lower, upper]
}

function betaInv(p: number, alpha: number, beta: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let lo = 0, hi = 1
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const cdfVal = betaCdf(mid, alpha, beta)
    if (Math.abs(cdfVal - p) < 1e-10) return mid
    if (cdfVal < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function betaCdf(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return regularizedBeta(x, alpha, beta)
}

function regularizedBeta(x: number, a: number, b: number): number {
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedBeta(1 - x, b, a)
  }
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a
  let f = 1, c = 1, d = 0
  for (let i = 0; i <= 200; i++) {
    let m: number
    if (i % 2 === 0) {
      m = i / 2
      d = 1 + (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
    } else {
      m = (i - 1) / 2
      d = 1 + (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
    }
    if (Math.abs(d) < 1e-30) d = 1e-30
    d = 1 / d
    c = 1 + (1 / c) * ((i % 2 === 0 ? m * (b - m) : -(a + m) * (a + b + m)) * x / ((i % 2 === 0 ? (a + 2 * m - 1) : (a + 2 * m)) * (i % 2 === 0 ? (a + 2 * m) : (a + 2 * m + 1))))
    if (Math.abs(c) < 1e-30) c = 1e-30
    f *= (c * d)
    if (Math.abs(c * d - 1) < 1e-10) break
  }
  return front * f
}

export function bayesianUpdate(
  prior: PriorParams,
  observations: Observation[],
  boundary: BoundaryConfig = DEFAULT_BOUNDARY,
  batchId: string = generateId()
): PosteriorResult {
  const warnings: Warning[] = []
  const priorSnapshot: PriorParams = { ...prior }

  if (prior.type === 'beta') {
    let postAlpha = prior.alpha
    let postBeta = prior.beta

    for (const obs of observations) {
      postAlpha += obs.conversions
      postBeta += (obs.clicks - obs.conversions)
    }

    if (postAlpha > boundary.maxAlpha) {
      warnings.push({
        type: 'boundary_exceeded',
        field: 'alpha',
        message: `后验 α=${postAlpha.toFixed(1)} 超出上限 ${boundary.maxAlpha}`,
        detail: `先验 α=${prior.alpha} + 总转化=${observations.reduce((s, o) => s + o.conversions, 0)} = ${postAlpha.toFixed(1)}，建议检查转化数据是否合理`,
        severity: 'error',
      })
    }
    if (postBeta > boundary.maxBeta) {
      warnings.push({
        type: 'boundary_exceeded',
        field: 'beta',
        message: `后验 β=${postBeta.toFixed(1)} 超出上限 ${boundary.maxBeta}`,
        detail: `先验 β=${prior.beta} + 总非转化=${observations.reduce((s, o) => s + (o.clicks - o.conversions), 0)} = ${postBeta.toFixed(1)}`,
        severity: 'error',
      })
    }

    const mean = betaMean(postAlpha, postBeta)
    const variance = betaVar(postAlpha, postBeta)
    const [credLower, credUpper] = betaCredibleInterval(postAlpha, postBeta)

    return {
      computeId: generateId(),
      batchId,
      priorSnapshot,
      posteriorParams: { type: 'beta', alpha: postAlpha, beta: postBeta },
      observations: [...observations],
      warnings,
      computedAt: new Date().toLocaleString('zh-CN'),
      posteriorMean: mean,
      posteriorStd: Math.sqrt(variance),
      credibleLower: credLower,
      credibleUpper: credUpper,
    }
  }

  if (prior.type === 'normal') {
    const mu0 = prior.mu!
    const sigma0_2 = prior.sigma2!
    let n = 0
    let sum = 0
    for (const obs of observations) {
      const rate = obs.clicks > 0 ? obs.conversions / obs.clicks : 0
      n += 1
      sum += rate
    }
    const xBar = n > 0 ? sum / n : 0
    const sigma2 = n > 1 ? observations.reduce((s, o) => {
      const rate = o.clicks > 0 ? o.conversions / o.clicks : 0
      return s + (rate - xBar) ** 2
    }, 0) / (n - 1) : sigma0_2

    const postSigma2 = 1 / (1 / sigma0_2 + n / sigma2)
    const postMu = postSigma2 * (mu0 / sigma0_2 + n * xBar / sigma2)

    if (Math.abs(postMu) > boundary.maxMu) {
      warnings.push({
        type: 'boundary_exceeded',
        field: 'mu',
        message: `后验 μ=${postMu.toFixed(4)} 超出上限 ${boundary.maxMu}`,
        detail: `先验 μ=${mu0}，观测均值=${xBar.toFixed(4)}，样本量=${n}`,
        severity: 'error',
      })
    }
    if (postSigma2 > boundary.maxSigma2) {
      warnings.push({
        type: 'boundary_exceeded',
        field: 'sigma2',
        message: `后验 σ²=${postSigma2.toFixed(6)} 超出上限 ${boundary.maxSigma2}`,
        detail: `先验 σ²=${sigma0_2}，观测方差=${sigma2.toFixed(6)}`,
        severity: 'warn',
      })
    }

    return {
      computeId: generateId(),
      batchId,
      priorSnapshot,
      posteriorParams: { type: 'normal', alpha: 0, beta: 0, mu: postMu, sigma2: postSigma2 },
      observations: [...observations],
      warnings,
      computedAt: new Date().toLocaleString('zh-CN'),
      posteriorMean: postMu,
      posteriorStd: Math.sqrt(postSigma2),
      credibleLower: postMu - 1.96 * Math.sqrt(postSigma2),
      credibleUpper: postMu + 1.96 * Math.sqrt(postSigma2),
    }
  }

  throw new Error(`不支持的先验类型: ${prior.type}`)
}

export function supplementNote(
  previousResult: PosteriorResult,
  newObs: Observation,
  prior: PriorParams,
  boundary: BoundaryConfig = DEFAULT_BOUNDARY,
  operatorName: string = '调度主管'
): SupplementDiff {
  const allObs = [...previousResult.observations, newObs]
  const afterResult = bayesianUpdate(prior, allObs, boundary, previousResult.batchId)

  const changedFields: ChangedField[] = []

  if (previousResult.posteriorParams.type === 'beta' && afterResult.posteriorParams.type === 'beta') {
    const fields: { field: string; before: number; after: number }[] = [
      { field: '后验 α', before: previousResult.posteriorParams.alpha, after: afterResult.posteriorParams.alpha },
      { field: '后验 β', before: previousResult.posteriorParams.beta, after: afterResult.posteriorParams.beta },
      { field: '后验均值', before: previousResult.posteriorMean, after: afterResult.posteriorMean },
      { field: '后验标准差', before: previousResult.posteriorStd, after: afterResult.posteriorStd },
      { field: '95%可信区间下界', before: previousResult.credibleLower, after: afterResult.credibleLower },
      { field: '95%可信区间上界', before: previousResult.credibleUpper, after: afterResult.credibleUpper },
    ]
    for (const f of fields) {
      if (Math.abs(f.after - f.before) > 1e-10) {
        changedFields.push({
          field: f.field,
          before: f.before,
          after: f.after,
          delta: f.after - f.before,
          reason: `补录了渠道「${newObs.channel}」的数据：曝光=${newObs.impressions}, 点击=${newObs.clicks}, 转化=${newObs.conversions}`,
        })
      }
    }
  }

  if (previousResult.posteriorParams.type === 'normal' && afterResult.posteriorParams.type === 'normal') {
    const fields: { field: string; before: number; after: number }[] = [
      { field: '后验 μ', before: previousResult.posteriorParams.mu!, after: afterResult.posteriorParams.mu! },
      { field: '后验 σ²', before: previousResult.posteriorParams.sigma2!, after: afterResult.posteriorParams.sigma2! },
      { field: '后验均值', before: previousResult.posteriorMean, after: afterResult.posteriorMean },
      { field: '后验标准差', before: previousResult.posteriorStd, after: afterResult.posteriorStd },
    ]
    for (const f of fields) {
      if (Math.abs(f.after - f.before) > 1e-10) {
        changedFields.push({
          field: f.field,
          before: f.before,
          after: f.after,
          delta: f.after - f.before,
          reason: `补录了渠道「${newObs.channel}」的数据：曝光=${newObs.impressions}, 点击=${newObs.clicks}, 转化=${newObs.conversions}`,
        })
      }
    }
  }

  return {
    supplementId: generateId(),
    computeId: previousResult.computeId,
    obsId: newObs.obsId,
    before: previousResult,
    after: afterResult,
    changedFields,
    supplementedAt: new Date().toLocaleString('zh-CN'),
    supplementedBy: operatorName,
  }
}

export function checkUnits(observations: Observation[]): Warning[] {
  const warnings: Warning[] = []
  const units = new Set(observations.map(o => o.unit))
  if (units.size > 1) {
    const unitList = Array.from(units).join('、')
    warnings.push({
      type: 'unit_mismatch',
      field: 'unit',
      message: `发现混合单位：${unitList}`,
      detail: `不同单位的数据不能直接相加。CPM=千次曝光成本，CPC=单次点击成本，CPA=单次转化成本。建议先统一换算后再计算。`,
      severity: 'warn',
    })
  }
  return warnings
}

export function checkWeights(observations: Observation[]): Warning[] {
  const warnings: Warning[] = []
  const totalWeight = observations.reduce((s, o) => s + o.weight, 0)
  const tolerance = 0.01
  if (Math.abs(totalWeight - 1) > tolerance) {
    warnings.push({
      type: 'weight_not_closed',
      field: 'weight',
      message: `权重之和不等于1：合计=${totalWeight.toFixed(4)}`,
      detail: `当前各渠道权重加总为 ${totalWeight.toFixed(4)}，差额 ${(1 - totalWeight).toFixed(4)}。建议调整权重使总和为1，或确认这是有意为之。`,
      severity: totalWeight > 1.1 || totalWeight < 0.9 ? 'error' : 'warn',
    })
  }
  return warnings
}

export function checkBoundaries(
  observations: Observation[],
  boundary: BoundaryConfig = DEFAULT_BOUNDARY
): Warning[] {
  const warnings: Warning[] = []
  for (const obs of observations) {
    if (obs.conversions > boundary.maxConversions) {
      warnings.push({
        type: 'boundary_exceeded',
        field: `conversions(${obs.channel})`,
        message: `渠道「${obs.channel}」转化数 ${obs.conversions} 超出上限 ${boundary.maxConversions}`,
        detail: `该渠道转化数异常偏高，请确认数据来源是否正确。来源：${obs.source}`,
        severity: 'error',
      })
    }
    if (obs.conversions < boundary.minConversions) {
      warnings.push({
        type: 'boundary_exceeded',
        field: `conversions(${obs.channel})`,
        message: `渠道「${obs.channel}」转化数 ${obs.conversions} 低于下限 ${boundary.minConversions}`,
        detail: `该渠道转化数为负或异常偏低。来源：${obs.source}`,
        severity: 'warn',
      })
    }
  }
  return warnings
}

export function detectOutliers(
  observations: Observation[],
  threshold: number = DEFAULT_BOUNDARY.outlierStdThreshold
): Observation[] {
  if (observations.length < 3) return []
  const rates = observations.map(o => o.clicks > 0 ? o.conversions / o.clicks : 0)
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length
  const std = Math.sqrt(rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length)
  if (std === 0) return []
  return observations.filter((_obs, i) => {
    const zScore = Math.abs((rates[i] - mean) / std)
    return zScore > threshold
  })
}

export { betaPdf, normalPdf, betaMean, betaVar, betaCredibleInterval, generateId, DEFAULT_BOUNDARY }
