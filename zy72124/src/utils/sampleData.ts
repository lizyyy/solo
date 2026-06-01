import type {
  MooringRecord,
  RawDataPoint,
  ProcessedDataPoint,
  ForceUnit,
  DataSource,
  CalculationParams,
  Judgment,
  ThresholdVersion,
} from "@/types"
import { convertToKN, fillGaps } from "@/utils/unitConversion"
import { calculateMooringForce } from "@/utils/calculation"

function makeRawData(
  values: (number | null)[],
  unit: ForceUnit
): RawDataPoint[] {
  return values.map((v, i) => ({
    sampleIndex: i,
    value: v,
    unit,
    isGap: v === null,
    interpolated: false,
  }))
}

function processRawData(raw: RawDataPoint[]): ProcessedDataPoint[] {
  const values = raw.map((r) => r.value)
  const filled = fillGaps(values)

  return raw.map((r, i) => {
    const wasInterpolated = r.isGap && filled[i] !== null
    const val = filled[i] ?? 0
    return {
      sampleIndex: i,
      valueKilonewtons: convertToKN(val, r.unit),
      originalUnit: r.unit,
      originalValue: wasInterpolated ? Math.round(val * 100) / 100 : (r.value ?? 0),
      wasInterpolated,
    }
  })
}

function makeJudgment(
  measuredPeakKN: number,
  threshold: ThresholdVersion,
  source: DataSource,
  interpolatedCount: number
): Judgment {
  const ratio = measuredPeakKN / threshold.valueKN
  let status: Judgment["status"]
  let statusLabel: string
  let reason: string

  if (ratio <= 0.8) {
    status = "pass"
    statusLabel = "通过"
    reason = `海上浮标系泊受力实测峰值 ${measuredPeakKN.toFixed(2)} kN 为阈值 ${threshold.valueKN} kN 的 ${(ratio * 100).toFixed(1)}%，低于80%安全线`
  } else if (ratio <= 1.0) {
    status = "confirm"
    statusLabel = "需人工确认"
    reason = `海上浮标系泊受力实测峰值 ${measuredPeakKN.toFixed(2)} kN 达到阈值 ${threshold.valueKN} kN 的 ${(ratio * 100).toFixed(1)}%，处于80%-100%确认区间`
  } else {
    status = "exceed"
    statusLabel = "超限告警"
    reason = `海上浮标系泊受力实测峰值 ${measuredPeakKN.toFixed(2)} kN 超过阈值 ${threshold.valueKN} kN（${(ratio * 100).toFixed(1)}%），已超出安全范围`
  }

  if (interpolatedCount > 0) {
    reason += `；存在${interpolatedCount}个采样缺口已线性插值补充`
  }
  if (source === "legacy_supplement") {
    reason += "；数据来源为传感器日志旧口径补录"
  }
  if (source === "sensor_log") {
    reason += "；数据来源为传感器日志直接采集"
  }

  return {
    status,
    statusLabel,
    reason,
    thresholdVersion: threshold.version,
    thresholdValueKN: threshold.valueKN,
    ratioToThreshold: ratio,
    judgedAt: new Date().toISOString(),
  }
}

function buildRecord(
  id: string,
  label: string,
  source: DataSource,
  sourceNote: string,
  rawValues: (number | null)[],
  unit: ForceUnit,
  params: CalculationParams,
  threshold: ThresholdVersion
): MooringRecord {
  const rawData = makeRawData(rawValues, unit)
  const processedData = processRawData(rawData)
  const forceResult = calculateMooringForce(params, processedData)
  const interpolatedCount = processedData.filter((p) => p.wasInterpolated).length
  const judgment = makeJudgment(forceResult.measuredPeakKN, threshold, source, interpolatedCount)

  return {
    id,
    label,
    source,
    sourceNote,
    timestamp: new Date().toISOString(),
    rawData,
    processedData,
    forceResult,
    judgment,
  }
}

export function createSampleData(threshold: ThresholdVersion): MooringRecord[] {
  const params001: CalculationParams = {
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

  const params002: CalculationParams = {
    ...params001,
    currentVelocity: 2.0,
    waveAcceleration: 2.5,
    windVelocity: 20,
  }

  const params003: CalculationParams = {
    ...params001,
    currentVelocity: 1.0,
    waveAcceleration: 0.8,
    windVelocity: 8,
  }

  return [
    buildRecord(
      "REC-001",
      "顺利记录",
      "manual",
      "手动录入，8采样点完整",
      [11.2, 11.8, 12.1, 12.5, 12.3, 11.9, 12.0, 11.7],
      "kN",
      params001,
      threshold
    ),
    buildRecord(
      "REC-002",
      "需人工确认",
      "manual",
      "手动录入，第3-4采样点缺失，已线性插值",
      [24.5, 25.2, null, null, 26.8, 26.1, 25.8, 25.5],
      "kN",
      params002,
      threshold
    ),
    buildRecord(
      "REC-003",
      "旧口径补录",
      "legacy_supplement",
      "传感器日志旧口径补录，第5采样点缺失，单位N",
      [5200, 5400, 5600, 5800, null, 5500, 5300, 5100],
      "N",
      params003,
      threshold
    ),
  ]
}
