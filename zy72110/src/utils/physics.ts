import { GRAVITY } from '@/types'
import type { AngleUnit, LengthUnit, VelocityUnit, TimeUnit } from '@/types'

export function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI)
}

export function normalizeAngle(value: number, unit: AngleUnit): number {
  return unit === 'rad' ? radToDeg(value) : value
}

export function normalizeLength(value: number, unit: LengthUnit): number {
  return unit === 'cm' ? value / 100 : value
}

export function normalizeVelocity(value: number, unit: VelocityUnit): number {
  return unit === 'cm/s' ? value / 100 : value
}

export function normalizeTime(value: number, unit: TimeUnit): number {
  return unit === 'ms' ? value / 1000 : value
}

export function swingPeriod(ropeLengthM: number): number {
  return 2 * Math.PI * Math.sqrt(ropeLengthM / GRAVITY)
}

export function dampingRatio(currentAngleDeg: number, previousAngleDeg: number): number {
  if (previousAngleDeg <= 0 || currentAngleDeg <= 0 || currentAngleDeg >= previousAngleDeg) {
    return 0
  }
  const logDecrement = Math.log(previousAngleDeg / currentAngleDeg)
  return logDecrement / (2 * Math.PI)
}

export function residualAngle(
  initialAngleDeg: number,
  zeta: number,
  ropeLengthM: number,
  observationDurationS: number
): number {
  const omega = (2 * Math.PI) / swingPeriod(ropeLengthM)
  const exponent = -zeta * omega * observationDurationS
  return initialAngleDeg * Math.exp(exponent)
}

export function parameterHash(
  ropeLength: number,
  angle: number,
  velocity: number,
  interval: number
): string {
  const raw = `${ropeLength.toFixed(3)}|${angle.toFixed(4)}|${velocity.toFixed(4)}|${interval.toFixed(4)}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
