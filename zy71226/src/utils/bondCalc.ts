import { YieldCurvePoint, Bond, PortfolioPosition, TENOR_YEARS, Tenor } from '@/types'

export function interpolateRate(curve: YieldCurvePoint[], year: number): number {
  const sorted = [...curve].sort((a, b) => TENOR_YEARS[a.tenor] - TENOR_YEARS[b.tenor])
  if (year <= TENOR_YEARS[sorted[0].tenor]) return sorted[0].rate / 100
  if (year >= TENOR_YEARS[sorted[sorted.length - 1].tenor]) return sorted[sorted.length - 1].rate / 100

  for (let i = 0; i < sorted.length - 1; i++) {
    const t1 = TENOR_YEARS[sorted[i].tenor]
    const t2 = TENOR_YEARS[sorted[i + 1].tenor]
    if (year >= t1 && year <= t2) {
      const r1 = sorted[i].rate / 100
      const r2 = sorted[i + 1].rate / 100
      const frac = (year - t1) / (t2 - t1)
      return r1 + frac * (r2 - r1)
    }
  }
  return sorted[sorted.length - 1].rate / 100
}

export function calculateBondPrice(bond: Bond, curve: YieldCurvePoint[]): number {
  if (bond.type === 'floating') return bond.faceValue

  let price = 0
  const annualCoupon = bond.faceValue * bond.coupon
  const matYears = bond.maturity
  const periods = Math.ceil(matYears)

  for (let t = 1; t <= periods; t++) {
    const frac = t <= matYears ? 1 : 0
    if (t > matYears) continue
    const exactT = t <= matYears ? t : matYears
    const y = interpolateRate(curve, exactT)
    const isLast = t === periods || (t === Math.floor(matYears) && matYears === Math.floor(matYears))
    const cf = isLast ? annualCoupon + bond.faceValue : annualCoupon
    if (t === Math.ceil(matYears) && matYears < periods) {
      const partialCf = annualCoupon * (matYears - Math.floor(matYears)) + bond.faceValue
      price += partialCf / Math.pow(1 + y, matYears)
    } else {
      price += cf / Math.pow(1 + y, t)
    }
  }

  if (matYears < 1) {
    const y = interpolateRate(curve, matYears)
    const cf = annualCoupon * matYears + bond.faceValue
    price = cf / Math.pow(1 + y, matYears)
  }

  return Math.round(price * 100) / 100
}

export function calculateMacaulayDuration(bond: Bond, curve: YieldCurvePoint[]): number {
  if (bond.type === 'floating') return bond.maturity

  let weightedSum = 0
  let price = 0
  const annualCoupon = bond.faceValue * bond.coupon
  const matYears = bond.maturity

  if (matYears < 1) {
    const y = interpolateRate(curve, matYears)
    const cf = annualCoupon * matYears + bond.faceValue
    price = cf / Math.pow(1 + y, matYears)
    weightedSum = matYears * price
    return price > 0 ? Math.round((weightedSum / price) * 100) / 100 : 0
  }

  const periods = Math.ceil(matYears)
  for (let t = 1; t <= periods; t++) {
    if (t > matYears) continue
    const exactT = Math.min(t, matYears)
    const y = interpolateRate(curve, exactT)
    const isLast = t === periods
    const cf = isLast ? annualCoupon + bond.faceValue : annualCoupon

    if (t === Math.ceil(matYears) && matYears !== Math.floor(matYears)) {
      const partialCf = annualCoupon * (matYears - Math.floor(matYears)) + bond.faceValue
      const pv = partialCf / Math.pow(1 + y, matYears)
      price += pv
      weightedSum += matYears * pv
    } else {
      const pv = cf / Math.pow(1 + y, exactT)
      price += pv
      weightedSum += exactT * pv
    }
  }

  return price > 0 ? Math.round((weightedSum / price) * 100) / 100 : 0
}

export function calculatePortfolioDuration(
  positions: PortfolioPosition[],
  bonds: Bond[],
  curve: YieldCurvePoint[]
): number {
  let weightedDuration = 0
  let totalWeight = 0

  for (const pos of positions) {
    const bond = bonds.find(b => b.id === pos.bondId)
    if (!bond || pos.weight <= 0) continue
    const dur = calculateMacaulayDuration(bond, curve)
    weightedDuration += pos.weight * dur
    totalWeight += pos.weight
  }

  return totalWeight > 0 ? Math.round((weightedDuration / totalWeight) * 100) / 100 : 0
}

export function calculateDurationScore(actual: number, target: number): number {
  const diff = Math.abs(actual - target)
  const maxDiff = 5
  const score = Math.max(0, Math.round((1 - diff / maxDiff) * 100))
  return score
}

export function tenorToX(tenor: Tenor, width: number, padding: number): number {
  const years = TENOR_YEARS[tenor]
  const maxYear = 30
  return padding + (years / maxYear) * (width - 2 * padding)
}

export function rateToY(rate: number, height: number, padding: number, minRate: number, maxRate: number): number {
  const range = maxRate - minRate || 1
  return height - padding - ((rate - minRate) / range) * (height - 2 * padding)
}
