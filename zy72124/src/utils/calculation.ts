import type { CalculationParams, ForceResult, ProcessedDataPoint } from "@/types"

export const DEFAULT_PARAMS: CalculationParams = {
  waterDensity: 1025,
  airDensity: 1.225,
  dragCoeffCurrent: 1.2,
  inertiaCoeff: 2.0,
  dragCoeffWind: 1.0,
  submergedArea: 2.0,
  aerialArea: 1.5,
  currentVelocity: 1.5,
  waveAcceleration: 1.2,
  windVelocity: 10,
}

export function calculateCurrentForce(params: CalculationParams): number {
  const { waterDensity, dragCoeffCurrent, submergedArea, currentVelocity } = params
  return 0.5 * waterDensity * dragCoeffCurrent * submergedArea * currentVelocity ** 2
}

export function calculateWaveForce(params: CalculationParams): number {
  const { waterDensity, inertiaCoeff, submergedArea, waveAcceleration } = params
  return 0.5 * waterDensity * inertiaCoeff * submergedArea * waveAcceleration
}

export function calculateWindForce(params: CalculationParams): number {
  const { airDensity, dragCoeffWind, aerialArea, windVelocity } = params
  return 0.5 * airDensity * dragCoeffWind * aerialArea * windVelocity ** 2
}

export function calculateMooringForce(
  params: CalculationParams,
  processedData: ProcessedDataPoint[]
): ForceResult {
  const measuredValues = processedData.map((p) => p.valueKilonewtons)
  const measuredPeakKN = Math.max(...measuredValues)
  const measuredAvgKN = measuredValues.reduce((a, b) => a + b, 0) / measuredValues.length

  const currentForceN = calculateCurrentForce(params)
  const waveForceN = calculateWaveForce(params)
  const windForceN = calculateWindForce(params)
  const totalForceN = currentForceN + waveForceN + windForceN

  const theoreticalCurrentKN = currentForceN / 1000
  const theoreticalWaveKN = waveForceN / 1000
  const theoreticalWindKN = windForceN / 1000
  const theoreticalTotalKN = totalForceN / 1000

  const deviation = Math.abs(measuredPeakKN - theoreticalTotalKN)
  const deviationPct = theoreticalTotalKN > 0 ? (deviation / theoreticalTotalKN) * 100 : 0

  let deviationNote = ""
  if (deviationPct < 10) {
    deviationNote = `实测峰值 ${measuredPeakKN.toFixed(2)} kN 与理论值 ${theoreticalTotalKN.toFixed(2)} kN 偏差 ${deviationPct.toFixed(1)}%，在合理范围内`
  } else if (deviationPct < 30) {
    deviationNote = `实测峰值 ${measuredPeakKN.toFixed(2)} kN 与理论值 ${theoreticalTotalKN.toFixed(2)} kN 偏差 ${deviationPct.toFixed(1)}%，存在中等偏差，建议核查环境参数`
  } else {
    deviationNote = `实测峰值 ${measuredPeakKN.toFixed(2)} kN 与理论值 ${theoreticalTotalKN.toFixed(2)} kN 偏差 ${deviationPct.toFixed(1)}%，偏差较大，需重点核查参数与工况`
  }

  return {
    measuredPeakKN,
    measuredAvgKN,
    theoreticalTotalKN,
    theoreticalCurrentKN,
    theoreticalWaveKN,
    theoreticalWindKN,
    formulaUsed: "F_total = F_current + F_wave + F_wind（理论参考）",
    paramsUsed: { ...params },
    deviationNote,
  }
}

export function getFormulaBreakdown(params: CalculationParams): string[] {
  return [
    `F_current = 0.5 × ${params.waterDensity} × ${params.dragCoeffCurrent} × ${params.submergedArea} × ${params.currentVelocity}²`,
    `F_wave = 0.5 × ${params.waterDensity} × ${params.inertiaCoeff} × ${params.submergedArea} × ${params.waveAcceleration}`,
    `F_wind = 0.5 × ${params.airDensity} × ${params.dragCoeffWind} × ${params.aerialArea} × ${params.windVelocity}²`,
  ]
}
