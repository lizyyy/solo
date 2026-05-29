import type { StabilityResult, AnomalyType, ParamState } from "@/types"

const MU_0 = 4 * Math.PI * 1e-7
const G = 9.8
const STABLE_THRESHOLD = 1.2
const CRITICAL_THRESHOLD = 0.8
const DIVERGENCE_STEPS = 3

export function computeMagneticForce(params: ParamState): number {
  const d = Math.max(params.magnetSpacing / 1000, 1e-6)
  const m1 = params.current * 0.5
  const m2 = params.current * 0.5
  const force = (MU_0 * m1 * m2) / (4 * Math.PI * Math.pow(d, 3))
  return force
}

export function computeGravity(params: ParamState): number {
  return (params.vehicleMass / 1000) * G
}

export function computeOscillationAmplitude(
  netForce: number,
  disturbance: number
): number {
  if (Math.abs(netForce) < 0.01) return disturbance
  return disturbance * (1 + Math.abs(netForce) * 2)
}

export function checkDivergence(amplitudes: number[]): boolean {
  if (amplitudes.length < DIVERGENCE_STEPS) return false
  const last = amplitudes.slice(-DIVERGENCE_STEPS)
  return last.every((v, i) => i === 0 || v > last[i - 1])
}

export function determineStability(params: ParamState): StabilityResult {
  const magneticForce = computeMagneticForce(params)
  const gravityForce = computeGravity(params)
  const netForce = magneticForce - gravityForce
  const ratio = gravityForce > 0 ? magneticForce / gravityForce : 0
  const oscillationAmplitude = computeOscillationAmplitude(
    netForce,
    params.disturbance
  )

  let status: StabilityResult["status"]
  if (ratio > STABLE_THRESHOLD) {
    status = "stable"
  } else if (ratio >= CRITICAL_THRESHOLD) {
    status = "critical"
  } else {
    status = "unstable"
  }

  const result: StabilityResult = {
    status,
    magneticForce,
    gravityForce,
    netForce,
    ratio,
    oscillationAmplitude,
  }

  const anomaly = detectAnomaly(params, result)
  if (anomaly) {
    result.anomalyType = anomaly.type
    result.anomalyReason = anomaly.reason
    result.status = "unstable"
  }

  return result
}

interface AnomalyInfo {
  type: AnomalyType
  reason: string
}

function detectAnomaly(
  params: ParamState,
  result: StabilityResult
): AnomalyInfo | null {
  if (params.magnetSpacing <= 0) {
    return {
      type: "negative_spacing",
      reason: "磁铁间距不能为负或零，请调整间距",
    }
  }

  if (params.current < 0.1 || params.current > 50) {
    return {
      type: "current_exceed",
      reason: "电流超出安全范围(0.1~50A)，请调整",
    }
  }

  if (result.oscillationAmplitude > params.disturbance * 5) {
    return {
      type: "oscillation_diverge",
      reason: "振荡幅度持续增大，系统不稳定",
    }
  }

  return null
}
