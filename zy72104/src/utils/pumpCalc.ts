import type { EquipmentParams, CalcResult, SensorRecord, ConflictRecord } from '@/types'
import { convertToSI } from './unitConversion'

const G = 9.80665
const PI = Math.PI
const WATER_VISCOSITY = 1.002e-3

function toSI(value: number, unit: string, category?: string): number {
  const result = convertToSI(value, unit, category)
  return result.convertedValue ?? value
}

export function calculatePumpHead(params: EquipmentParams, records: SensorRecord[]): CalcResult {
  const suctionPa = toSI(params.suctionPressure, params.suctionPressureUnit, 'pressure')
  const dischargePa = toSI(params.dischargePressure, params.dischargePressureUnit, 'pressure')
  const densityVal = params.fluidDensity || 998.2
  const densityUnit = params.fluidDensityUnit || 'kg/m³'
  const density = densityUnit === 'g/cm³' ? densityVal * 1000 : densityVal

  const ratedHeadSI = toSI(params.ratedHead, params.ratedHeadUnit, 'length')
  const ratedFlowSI = toSI(params.ratedFlow, params.ratedFlowUnit, 'flow')
  const diameterSI = toSI(params.pipeDiameter, params.pipeDiameterUnit, 'diameter')
  const lengthSI = toSI(params.pipeLength, params.pipeLengthUnit, 'length')
  const elevationSI = toSI(params.elevationDiff, params.elevationDiffUnit, 'length')
  const roughnessSI = toSI(params.roughness, 'mm', 'roughness')

  const staticHead = elevationSI

  const pressureHeadDiff = (dischargePa - suctionPa) / (density * G)

  let actualFlow = ratedFlowSI
  const flowRecord = records.find((r) =>
    r.parameterName.includes('流量') || r.parameterName.toLowerCase().includes('flow')
  )
  if (flowRecord) {
    if (flowRecord.standardValue != null && flowRecord.standardValue !== 0) {
      actualFlow = flowRecord.standardValue
    } else {
      const flowConvSI = toSI(flowRecord.rawValue, flowRecord.rawUnit, 'flow')
      if (flowConvSI !== 0) actualFlow = flowConvSI
    }
  }

  const pipeArea = PI * Math.pow(diameterSI, 2) / 4
  const velocity = actualFlow / pipeArea
  const dynamicHead = Math.pow(velocity, 2) / (2 * G)

  const Re = density * velocity * diameterSI / WATER_VISCOSITY

  let frictionFactor: number
  if (Re < 2300) {
    frictionFactor = 64 / Re
  } else {
    const relativeRoughness = roughnessSI / diameterSI
    const logTerm = Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(Re, 0.9))
    frictionFactor = 0.25 / Math.pow(logTerm, 2)
  }

  const frictionLoss = frictionFactor * (lengthSI / diameterSI) * (Math.pow(velocity, 2) / (2 * G))

  const localLoss = params.localLossCoeff * (Math.pow(velocity, 2) / (2 * G))

  const totalLoss = frictionLoss + localLoss

  const totalHead = staticHead + pressureHeadDiff + dynamicHead + totalLoss

  const pumpEfficiency = params.efficiency > 0
    ? params.efficiency
    : ratedHeadSI > 0 ? (totalHead / ratedHeadSI) * 100 : 0

  const headDeviation = ratedHeadSI > 0
    ? ((totalHead - ratedHeadSI) / ratedHeadSI) * 100
    : 0

  const lossRatio = totalHead > 0 ? (totalLoss / totalHead) * 100 : 0

  return {
    staticHead,
    dynamicHead,
    frictionLoss,
    localLoss,
    totalHead,
    totalLoss,
    pumpEfficiency: Math.min(pumpEfficiency, 100),
    headDeviation,
    lossRatio,
    calcTime: new Date().toISOString(),
    formulaUsed: 'Darcy-Weisbach + 伯努利方程',
    reynoldsNumber: Re,
    frictionFactor,
  }
}

export function detectConflicts(
  params: EquipmentParams,
  records: SensorRecord[],
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = []

  const suctionRecord = records.find((r) =>
    r.parameterName.includes('进口压力') || r.parameterName.includes('吸入压力') ||
    r.parameterName.toLowerCase().includes('suction')
  )
  if (suctionRecord) {
    const recordSI = suctionRecord.standardValue ?? toSI(suctionRecord.rawValue, suctionRecord.rawUnit, 'pressure')
    const paramSI = toSI(params.suctionPressure, params.suctionPressureUnit, 'pressure')
    const diff = Math.abs(recordSI - paramSI)
    const threshold = Math.max(Math.abs(paramSI) * 0.1, 100)
    if (diff > threshold) {
      const recordDisplay = suctionRecord.standardValue != null
        ? `${suctionRecord.standardValue} ${suctionRecord.standardUnit}（≈${recordSI.toFixed(1)} Pa）`
        : `${suctionRecord.rawValue} ${suctionRecord.rawUnit}（≈${recordSI.toFixed(1)} Pa）`
      const paramDisplay = `${params.suctionPressure} ${params.suctionPressureUnit}（≈${paramSI.toFixed(1)} Pa）`
      conflicts.push({
        id: `conflict-suction-${Date.now()}`,
        fieldName: '吸入压力',
        inspectionValue: paramDisplay,
        importedValue: recordDisplay,
        inspectionUnit: params.suctionPressureUnit,
        importedUnit: suctionRecord.rawUnit,
        evidence: `换算为统一单位(Pa)后比较：巡检表 ${paramSI.toFixed(1)} Pa，传感器 ${recordSI.toFixed(1)} Pa，偏差 ${diff.toFixed(1)} Pa`,
        suggestedAction: '请核实吸入压力来源：以巡检表为准请选左侧，以传感器为准请选右侧',
        resolved: false,
        chosenSide: null,
      })
    }
  }

  const dischargeRecord = records.find((r) =>
    r.parameterName.includes('出口压力') || r.parameterName.includes('排出压力') ||
    r.parameterName.toLowerCase().includes('discharge')
  )
  if (dischargeRecord) {
    const recordSI = dischargeRecord.standardValue ?? toSI(dischargeRecord.rawValue, dischargeRecord.rawUnit, 'pressure')
    const paramSI = toSI(params.dischargePressure, params.dischargePressureUnit, 'pressure')
    const diff = Math.abs(recordSI - paramSI)
    const threshold = Math.max(Math.abs(paramSI) * 0.1, 100)
    if (diff > threshold) {
      const recordDisplay = dischargeRecord.standardValue != null
        ? `${dischargeRecord.standardValue} ${dischargeRecord.standardUnit}（≈${recordSI.toFixed(1)} Pa）`
        : `${dischargeRecord.rawValue} ${dischargeRecord.rawUnit}（≈${recordSI.toFixed(1)} Pa）`
      const paramDisplay = `${params.dischargePressure} ${params.dischargePressureUnit}（≈${paramSI.toFixed(1)} Pa）`
      conflicts.push({
        id: `conflict-discharge-${Date.now()}`,
        fieldName: '排出压力',
        inspectionValue: paramDisplay,
        importedValue: recordDisplay,
        inspectionUnit: params.dischargePressureUnit,
        importedUnit: dischargeRecord.rawUnit,
        evidence: `换算为统一单位(Pa)后比较：巡检表 ${paramSI.toFixed(1)} Pa，传感器 ${recordSI.toFixed(1)} Pa，偏差 ${diff.toFixed(1)} Pa`,
        suggestedAction: '请核实排出压力来源：以巡检表为准请选左侧，以传感器为准请选右侧',
        resolved: false,
        chosenSide: null,
      })
    }
  }

  return conflicts
}
