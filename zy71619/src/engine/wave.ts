import type { WaveCard, SamplePoint } from "@/types"

const SAMPLE_COUNT = 500
const X_RANGE = 4 * Math.PI

export function synthesizeWave(cards: WaveCard[], time: number = 0): SamplePoint[] {
  const points: SamplePoint[] = []
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const x = (i / SAMPLE_COUNT) * X_RANGE
    let y = 0
    for (const card of cards) {
      const phaseRad = card.phaseUnit === "degree" ? (card.phase * Math.PI) / 180 : card.phase
      y += card.amplitude * Math.sin(2 * Math.PI * card.frequency * x + phaseRad + time * 0.5)
    }
    points.push({ x, y })
  }
  return points
}

export function getWaveYAtX(cards: WaveCard[], x: number, time: number = 0): number {
  let y = 0
  for (const card of cards) {
    const phaseRad = card.phaseUnit === "degree" ? (card.phase * Math.PI) / 180 : card.phase
    y += card.amplitude * Math.sin(2 * Math.PI * card.frequency * x + phaseRad + time * 0.5)
  }
  return y
}

export function getWaveDerivativeAtX(cards: WaveCard[], x: number, time: number = 0): number {
  const dx = 0.001
  const y1 = getWaveYAtX(cards, x - dx, time)
  const y2 = getWaveYAtX(cards, x + dx, time)
  return (y2 - y1) / (2 * dx)
}

export function getTotalAmplitude(cards: WaveCard[]): number {
  return cards.reduce((sum, c) => sum + Math.abs(c.amplitude), 0)
}

export function getMaxWaveY(points: SamplePoint[]): number {
  return Math.max(...points.map((p) => Math.abs(p.y)))
}

export const X_RANGE_TOTAL = X_RANGE
export const MAX_AMPLITUDE = 10
