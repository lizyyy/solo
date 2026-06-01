import type { ComputationStep, ComputationTrace, HeatConductionResult, ExperimentRecord } from "@/types"

const ALPHA = 1.2e-7
const BEAN_RADIUS = 0.005
const RADIAL_NODES = 10
const DEFAULT_DR = BEAN_RADIUS / RADIAL_NODES
const DEFAULT_DT = 0.5

let traceCounter = 0

export function computeHeatConduction(
  record: ExperimentRecord,
  parameterVersion: number,
  thresholdVersion: number,
  thresholdMax: number,
): ComputationTrace | null {
  if (record.beanSurfaceTemp === null || record.beanCenterTemp === null) {
    return null
  }

  const dr = DEFAULT_DR
  const dt = DEFAULT_DT
  const durationSec = record.durationUnit === "s" ? record.duration! : record.duration! * 60
  const steps = Math.floor(durationSec / dt)
  const maxIter = Math.min(steps, 200)

  let T = new Array(RADIAL_NODES).fill(record.beanCenterTemp)
  T[RADIAL_NODES - 1] = record.beanSurfaceTemp

  const computationSteps: ComputationStep[] = []
  const stepInterval = Math.max(1, Math.floor(maxIter / 5))

  for (let n = 0; n < maxIter; n++) {
    const Tnew = [...T]
    for (let i = 1; i < RADIAL_NODES - 1; i++) {
      const r = (i + 0.5) * dr
      const d2T = (T[i + 1] - 2 * T[i] + T[i - 1]) / (dr * dr)
      const dT = (T[i + 1] - T[i - 1]) / (2 * dr)
      Tnew[i] = T[i] + ALPHA * dt * (d2T + dT / r)
    }
    T = Tnew

    if (n % stepInterval === 0 || n === maxIter - 1) {
      computationSteps.push({
        name: `迭代步 ${n + 1}/${maxIter}`,
        input: { surfaceTemp: T[RADIAL_NODES - 1], centerTemp: T[0] },
        formula: `T[i] += α·dt·(∂²T/∂r² + (1/r)·∂T/∂r), α=${ALPHA}, dt=${dt}s`,
        output: T[0],
        parameterVersionUsed: parameterVersion,
        thresholdVersionUsed: thresholdVersion,
      })
    }
  }

  const finalCenterTemp = T[0]
  const finalSurfaceTemp = T[RADIAL_NODES - 1]
  const gradient = finalSurfaceTemp - finalCenterTemp

  const result: HeatConductionResult = {
    finalCenterTemp: Math.round(finalCenterTemp * 100) / 100,
    finalSurfaceTemp: Math.round(finalSurfaceTemp * 100) / 100,
    gradient: Math.round(gradient * 100) / 100,
    isExceedingThreshold: finalCenterTemp > thresholdMax,
    thresholdVersionUsed: thresholdVersion,
    thresholdValueUsed: thresholdMax,
    radialProfile: T.map((t) => Math.round(t * 100) / 100),
  }

  return {
    id: `trace-${++traceCounter}`,
    recordId: record.id,
    batchId: record.batchId,
    parameterVersion,
    thresholdVersion,
    steps: computationSteps,
    result,
    computedAt: new Date().toLocaleString("zh-CN"),
  }
}

export function getTemperatureColor(temp: number, minTemp: number, maxTemp: number): string {
  const ratio = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)))
  if (ratio < 0.25) return `rgb(30, 60, 180)`
  if (ratio < 0.5) return `rgb(${Math.round(30 + ratio * 400)}, ${Math.round(60 + ratio * 200)}, ${Math.round(180 - ratio * 200)})`
  if (ratio < 0.75) return `rgb(${Math.round(200 + ratio * 55)}, ${Math.round(160 - ratio * 100)}, ${Math.round(50 - ratio * 50)})`
  return `rgb(220, ${Math.round(60 + (1 - ratio) * 100)}, 20)`
}
