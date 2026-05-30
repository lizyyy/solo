import type { ExchangeRate } from './types'

const BASE_RATE = 7.20
const RATE_VARIANCE = 0.36

export function generateRate(round: number, previousRate: number, forcedRate?: number): ExchangeRate {
  let rate: number
  if (forcedRate !== undefined) {
    rate = forcedRate
  } else {
    const change = (Math.random() - 0.5) * 2 * RATE_VARIANCE
    rate = Math.round((previousRate + change) * 1000) / 1000
    rate = Math.max(BASE_RATE - RATE_VARIANCE, Math.min(BASE_RATE + RATE_VARIANCE, rate))
  }
  const direction = rate > previousRate ? 'up' : rate < previousRate ? 'down' : 'stable'
  return { round, rate, previousRate, direction }
}
