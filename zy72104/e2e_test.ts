import type { SensorRecord, EquipmentParams, ManualCorrection, ConflictRecord, ThresholdAlert, Suggestion } from './src/types'
import { calculatePumpHead, detectConflicts } from './src/utils/pumpCalc'
import { checkThresholds, generateSuggestions } from './src/utils/thresholdCheck'
import { validateTimeInterval, convertToSI } from './src/utils/unitConversion'

function toSI(value: number, unit: string, category?: string): number {
  const r = convertToSI(value, unit, category)
  return r.convertedValue ?? value
}

const EQUIPMENT_FIELD_MAP: Record<string, { valueKey: keyof EquipmentParams; unitKey?: keyof EquipmentParams; category: string }> = {
  '额定扬程': { valueKey: 'ratedHead', unitKey: 'ratedHeadUnit', category: 'length' },
  '额定流量': { valueKey: 'ratedFlow', unitKey: 'ratedFlowUnit', category: 'flow' },
  '管径': { valueKey: 'pipeDiameter', unitKey: 'pipeDiameterUnit', category: 'diameter' },
  '管长': { valueKey: 'pipeLength', unitKey: 'pipeLengthUnit', category: 'length' },
  '粗糙度': { valueKey: 'roughness', category: 'roughness' },
  '吸入压力': { valueKey: 'suctionPressure', unitKey: 'suctionPressureUnit', category: 'pressure' },
  '排出压力': { valueKey: 'dischargePressure', unitKey: 'dischargePressureUnit', category: 'pressure' },
  '流体密度': { valueKey: 'fluidDensity', unitKey: 'fluidDensityUnit', category: 'dimensionless' },
  '高程差': { valueKey: 'elevationDiff', unitKey: 'elevationDiffUnit', category: 'length' },
  '局部损失系数': { valueKey: 'localLossCoeff', category: 'dimensionless' },
  '效率': { valueKey: 'efficiency', category: 'dimensionless' },
  '泵效率': { valueKey: 'efficiency', category: 'dimensionless' },
}

const SENSOR_FIELD_MAP: Record<string, { paramKey: string }> = {
  '流量': { paramKey: '流量' },
  '进口压力': { paramKey: '进口压力' },
  '吸入压力': { paramKey: '进口压力' },
  '出口压力': { paramKey: '出口压力' },
  '排出压力': { paramKey: '出口压力' },
  '温度': { paramKey: '温度' },
  '振动值': { paramKey: '振动值' },
}

const STANDARD_UNIT_MAP: Record<string, string> = {
  pressure: 'Pa', flow: 'm³/s', temperature: 'K', velocity: 'm/s',
  length: 'm', diameter: 'm', roughness: 'm', dimensionless: '',
}

function getCategoryByParamName(paramName: string): string {
  if (paramName.includes('压力')) return 'pressure'
  if (paramName.includes('流量')) return 'flow'
  if (paramName.includes('温度')) return 'temperature'
  if (paramName.includes('振动') || paramName.includes('速度')) return 'velocity'
  if (paramName.includes('管径')) return 'diameter'
  if (paramName.includes('管长') || paramName.includes('扬程') || paramName.includes('高程')) return 'length'
  if (paramName.includes('粗糙')) return 'roughness'
  return 'dimensionless'
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_PARAMS: EquipmentParams = {
  pumpModel: 'IS80-65-160', ratedHead: 32, ratedHeadUnit: 'm',
  ratedFlow: 50, ratedFlowUnit: 'm³/h', pipeDiameter: 200, pipeDiameterUnit: 'mm',
  pipeLength: 150, pipeLengthUnit: 'm', roughness: 0.2, efficiency: 75,
  suctionPressure: 0.5, suctionPressureUnit: 'kgf/cm²',
  dischargePressure: 3.5, dischargePressureUnit: 'kgf/cm²',
  fluidDensity: 1.0, fluidDensityUnit: 'g/cm³',
  elevationDiff: 8, elevationDiffUnit: 'm', localLossCoeff: 5.0,
}

function makeSampleRecords(irregular = false): SensorRecord[] {
  return [
    { id: uid(), parameterName: '进口压力', rawValue: 0.48, rawUnit: 'kgf/cm²', standardValue: 47073, standardUnit: 'Pa', timestamp: '2026-06-01T08:00:00', direction: '吸入', source: '巡检表', validated: true, validationMessage: '' },
    { id: uid(), parameterName: '出口压力', rawValue: 3.2, rawUnit: 'kgf/cm²', standardValue: 313813, standardUnit: 'Pa', timestamp: '2026-06-01T08:00:00', direction: '排出', source: '传感器', validated: true, validationMessage: '' },
    { id: uid(), parameterName: '流量', rawValue: 45, rawUnit: 'm³/h', standardValue: 0.0125, standardUnit: 'm³/s', timestamp: irregular ? '2026-06-01T08:00:00' : '2026-06-01T08:00:00', direction: '', source: '传感器', validated: true, validationMessage: '' },
    { id: uid(), parameterName: '温度', rawValue: 22, rawUnit: '°C', standardValue: 295.15, standardUnit: 'K', timestamp: irregular ? '2026-06-01T08:01:00' : '2026-06-01T08:05:00', direction: '', source: '传感器', validated: true, validationMessage: '' },
    { id: uid(), parameterName: '振动值', rawValue: 3.2, rawUnit: 'mm/s', standardValue: 0.0032, standardUnit: 'm/s', timestamp: irregular ? '2026-06-01T08:10:00' : '2026-06-01T08:10:00', direction: '', source: '巡检表', validated: true, validationMessage: '' },
  ]
}

interface StepReport {
  title: string
  pass: boolean
  detail: string
}

function runCalcStep(params: EquipmentParams, records: SensorRecord[], corrections: ManualCorrection[], conflicts: ConflictRecord[]) {
  const effectiveParams: EquipmentParams = { ...params }
  const effectiveRecords: SensorRecord[] = records.map((r) => ({ ...r }))

  corrections.forEach((corr) => {
    const eqMap = EQUIPMENT_FIELD_MAP[corr.fieldName]
    if (eqMap) {
      ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.valueKey as string] = corr.correctedValue
      if (eqMap.unitKey && corr.correctedUnit) {
        ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.unitKey as string] = corr.correctedUnit
      }
    } else {
      const sensorMap = SENSOR_FIELD_MAP[corr.fieldName]
      if (sensorMap) {
        const idx = effectiveRecords.findIndex((r) => r.parameterName === sensorMap.paramKey)
        if (idx !== -1) {
          const category = getCategoryByParamName(sensorMap.paramKey)
          const standardVal = toSI(corr.correctedValue, corr.correctedUnit || effectiveRecords[idx].rawUnit, category)
          const standardUnit = STANDARD_UNIT_MAP[category] || effectiveRecords[idx].standardUnit
          effectiveRecords[idx] = {
            ...effectiveRecords[idx],
            rawValue: corr.correctedValue,
            rawUnit: corr.correctedUnit || effectiveRecords[idx].rawUnit,
            standardValue: standardVal,
            standardUnit,
          }
        }
      }
    }
  })

  conflicts.forEach((c) => {
    if (!c.resolved || !c.chosenSide) return
    if (c.fieldName === '吸入压力' || c.fieldName === '排出压力') {
      const eqMap = EQUIPMENT_FIELD_MAP[c.fieldName]
      if (!eqMap) return
      const recordKey = c.fieldName === '吸入压力' ? '进口压力' : '出口压力'
      const record = effectiveRecords.find((r) => r.parameterName === recordKey)
      if (c.chosenSide === 'imported' && record) {
        ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.valueKey as string] = record.rawValue
        if (eqMap.unitKey) {
          ;(effectiveParams as unknown as Record<string, unknown>)[eqMap.unitKey as string] = record.rawUnit
        }
      }
    }
  })

  const result = calculatePumpHead(effectiveParams, effectiveRecords)
  const timeValidation = validateTimeInterval(effectiveRecords.map((r) => r.timestamp).filter(Boolean))
  const alertsUnshifted: ThresholdAlert[] = checkThresholds(result)
  const alerts: ThresholdAlert[] = timeValidation.valid ? alertsUnshifted : [
    {
      id: 'alert-time', alertType: '时间间隔', level: 'notice',
      value: 0, threshold: 0, unit: 's',
      message: timeValidation.message,
      suggestion: '采样间隔不稳定可能影响趋势判断，请检查采集设备或补充缺失数据',
    },
    ...alertsUnshifted,
  ]
  const suggestionsBase: Suggestion[] = generateSuggestions(result, alerts)
  const suggestions: Suggestion[] = (timeValidation.valid || suggestionsBase.some((sg) => sg.category.includes('采样') || sg.category.includes('时间')))
    ? suggestionsBase
    : [
        ...suggestionsBase,
        {
          id: 'sug-time', category: '采样质量', priority: 'notice',
          action: '检查采集日志，确认是否有跳点或漏采；如持续异常请校准采集器时钟',
          explanation: timeValidation.message,
        },
      ]
  const detectedConflicts = detectConflicts(effectiveParams, effectiveRecords)

  return { effectiveParams, effectiveRecords, result, timeValidation, alerts, suggestions, conflicts: detectedConflicts }
}

const reports: StepReport[] = []
let stepNo = 0
function step(title: string, fn: () => { pass: boolean; detail: string }) {
  stepNo++
  process.stdout.write(`\n=== 步骤 ${stepNo}: ${title} ===\n`)
  const r = fn()
  process.stdout.write((r.pass ? '✅ PASS ' : '❌ FAIL ') + r.detail + '\n')
  reports.push({ title, ...r })
}

function main() {
  process.stdout.write('\n==================================================\n')
  process.stdout.write('水泵扬程管损估算 - 端到端测试\n')
  process.stdout.write('==================================================\n')

  // ========== 路径 A：正常样例 + 人工修正 ==========
  step('A1 加载原始样例，首次计算', () => {
    const params = { ...DEFAULT_PARAMS }
    const records = makeSampleRecords(false)
    const out = runCalcStep(params, records, [], [])
    const pass =
      out.result.totalHead > 38 && out.result.totalHead < 39 &&
      out.result.totalLoss > 0.1 && out.result.totalLoss < 0.3 &&
      out.result.headDeviation > 18 && out.result.headDeviation < 21 &&
      out.timeValidation.valid === true
    return { pass, detail:
      `总扬程=${out.result.totalHead.toFixed(2)}m (预期 ~38.19m), ` +
      `管损=${out.result.totalLoss.toFixed(3)}m (预期 >0 非零), ` +
      `扬程偏差=${out.result.headDeviation.toFixed(1)}% (预期 ~19.3%), ` +
      `时间校验 valid=${out.timeValidation.valid} (预期 true)` }
  })

  step('A2 添加人工修正：排出压力 3.5→3.2，重算', () => {
    const params = { ...DEFAULT_PARAMS }
    const records = makeSampleRecords(false)
    const corr: ManualCorrection = {
      id: uid(), fieldName: '排出压力',
      originalValue: 3.5, originalUnit: 'kgf/cm²',
      correctedValue: 3.2, correctedUnit: 'kgf/cm²',
      reason: '传感器读数 3.2 更接近实际', correctionTime: new Date().toISOString(),
    }
    const out = runCalcStep(params, records, [corr], [])
    // 关键点：effectiveParams.dischargePressure 应被改为 3.2
    const passEffective = out.effectiveParams.dischargePressure === 3.2
    // 关键点：原始 params 未被修改
    const passOriginal = params.dischargePressure === 3.5
    // 计算应是用了 3.2，压力头差 ~27m，总扬程 ~35.19m
    const passTotal = out.result.totalHead > 34.5 && out.result.totalHead < 36
    const passLoss = out.result.totalLoss > 0.1
    const pass = passEffective && passOriginal && passTotal && passLoss
    return { pass, detail:
      `原始设备参数排出压力保留=${params.dischargePressure} (预期 3.5, ${passOriginal ? 'OK' : 'FAIL'}), ` +
      `计算副本排出压力=${out.effectiveParams.dischargePressure} (预期 3.2, ${passEffective ? 'OK' : 'FAIL'}), ` +
      `总扬程=${out.result.totalHead.toFixed(2)}m (预期 ~35.19, ${passTotal ? 'OK' : 'FAIL'}), ` +
      `管损=${out.result.totalLoss.toFixed(3)}m (>0 ${passLoss ? 'OK' : 'FAIL'})` }
  })

  // ========== 路径 B：造冲突 + 选择传感器/巡检表 ==========
  step('B1 造吸入/排出压力冲突，未解决时按巡检表值计算', () => {
    const params = { ...DEFAULT_PARAMS, suctionPressure: 0.8, dischargePressure: 4.0 }
    const records = makeSampleRecords(false) // 传感器 吸=0.48 / 排=3.2
    const out = runCalcStep(params, records, [], [])
    // 用巡检表 4.0 - 0.8 压力头差 ~32m，总扬程 ~40m
    const passHead = out.result.totalHead > 39 && out.result.totalHead < 41
    // detectConflicts 应检测到两处冲突
    const passConflicts = out.conflicts.length >= 2
    const pass = passHead && passConflicts
    return { pass, detail:
      `总扬程=${out.result.totalHead.toFixed(2)}m (预期 ~40.19，巡检表值), ` +
      `检测到冲突数=${out.conflicts.length} (预期 2, 吸+排)，` +
      `冲突字段=${out.conflicts.map(c => c.fieldName).join('/')}` }
  })

  step('B2 冲突解决：都选传感器侧，重算应使用传感器值', () => {
    const params = { ...DEFAULT_PARAMS, suctionPressure: 0.8, dischargePressure: 4.0 }
    const records = makeSampleRecords(false)
    // 先检测冲突
    const { conflicts: detected } = runCalcStep(params, records, [], [])
    const resolved = detected.map((c) => ({ ...c, resolved: true, chosenSide: 'imported' as const }))
    const out = runCalcStep(params, records, [], resolved)
    // 用传感器 3.2 - 0.48 → 压力头差 ~27m，总扬程 ~35.39m
    const passHead = out.result.totalHead > 34.5 && out.result.totalHead < 36.5
    // 原始 params 没被改
    const passOriginal = params.suctionPressure === 0.8 && params.dischargePressure === 4.0
    // 计算副本被改
    const passEff = out.effectiveParams.suctionPressure === 0.48 && out.effectiveParams.dischargePressure === 3.2
    const pass = passHead && passOriginal && passEff
    return { pass, detail:
      `原始参数保留 吸=${params.suctionPressure} 排=${params.dischargePressure} (0.8/4.0: ${passOriginal ? 'OK' : 'FAIL'}), ` +
      `计算副本 吸=${out.effectiveParams.suctionPressure} 排=${out.effectiveParams.dischargePressure} (0.48/3.2: ${passEff ? 'OK' : 'FAIL'}), ` +
      `总扬程=${out.result.totalHead.toFixed(2)}m (预期 ~35.39, ${passHead ? 'OK' : 'FAIL'})` }
  })

  step('B3 冲突解决：都选巡检表侧，重算应保持巡检表值', () => {
    const params = { ...DEFAULT_PARAMS, suctionPressure: 0.8, dischargePressure: 4.0 }
    const records = makeSampleRecords(false)
    const { conflicts: detected } = runCalcStep(params, records, [], [])
    const resolved = detected.map((c) => ({ ...c, resolved: true, chosenSide: 'inspection' as const }))
    const out = runCalcStep(params, records, [], resolved)
    const passHead = out.result.totalHead > 39 && out.result.totalHead < 41
    const pass = passHead
    return { pass, detail:
      `选巡检表后总扬程=${out.result.totalHead.toFixed(2)}m (预期 ~40.19, ${passHead ? 'OK' : 'FAIL'})` }
  })

  // ========== 路径 C：采样间隔异常 ==========
  step('C1 时间间隔异常：应进入 alerts 阈值提醒 + suggestions 处理建议', () => {
    const params = { ...DEFAULT_PARAMS }
    const records = makeSampleRecords(true) // 08:00,08:00,08:00,08:07,08:10 → 间隔 0,0,420,180 秒
    const out = runCalcStep(params, records, [], [])
    const passValid = out.timeValidation.valid === false
    const passAlert = out.alerts.some((a) => a.alertType === '时间间隔')
    const passSug = out.suggestions.some((s) => s.category === '采样质量')
    const pass = passValid && passAlert && passSug
    return { pass, detail:
      `timeValidation.valid=${out.timeValidation.valid} (预期 false: ${passValid ? 'OK' : 'FAIL'}), ` +
      `message="${out.timeValidation.message}", ` +
      `alerts 含时间间隔=${passAlert ? 'OK' : 'FAIL'} (${out.alerts.map(a => a.alertType).join('/')}), ` +
      `suggestions 含采样质量=${passSug ? 'OK' : 'FAIL'} (${out.suggestions.map(s => s.category).join('/')}), ` +
      `实际间隔(s)=${out.timeValidation.intervals.join(',')}` }
  })

  step('C2 时间间隔正常：不应产生时间告警', () => {
    const params = { ...DEFAULT_PARAMS }
    const records = makeSampleRecords(false) // 08:00,08:00,08:00,08:05,08:10 → 同一时刻为主
    const out = runCalcStep(params, records, [], [])
    const passValid = out.timeValidation.valid === true
    const passAlert = !out.alerts.some((a) => a.alertType === '时间间隔')
    const pass = passValid && passAlert
    return { pass, detail:
      `timeValidation.valid=${out.timeValidation.valid} (预期 true: ${passValid ? 'OK' : 'FAIL'}), ` +
      `message="${out.timeValidation.message || '(空)'}", ` +
      `无时间间隔告警=${passAlert ? 'OK' : 'FAIL'}` }
  })

  // ========== 路径 D：综合闭环 ==========
  step('D1 综合：间隔异常 + 修正排出压力 + 冲突选传感器，结果正确串联', () => {
    const params = { ...DEFAULT_PARAMS, suctionPressure: 0.8, dischargePressure: 3.5 }
    // 传感器吸=0.48/排=3.2；先造成冲突；再加修正排出 3.5→3.1（极端值以便识别）；并间隔异常
    const records = makeSampleRecords(true)
    const corr: ManualCorrection = {
      id: uid(), fieldName: '排出压力',
      originalValue: 3.5, originalUnit: 'kgf/cm²',
      correctedValue: 3.1, correctedUnit: 'kgf/cm²',
      reason: '综合验证', correctionTime: new Date().toISOString(),
    }
    // 修正优先级更高：排出压力应取修正值 3.1；吸入压力冲突解决选传感器 0.48
    const { conflicts: detected } = runCalcStep(params, records, [corr], [])
    const resolved = detected.map((c) => c.fieldName === '吸入压力' ? { ...c, resolved: true, chosenSide: 'imported' as const } : c)
    const out = runCalcStep(params, records, [corr], resolved)
    const passDischarge = out.effectiveParams.dischargePressure === 3.1
    const passSuction = out.effectiveParams.suctionPressure === 0.48
    const headDiff = (out.result.totalHead - out.result.staticHead - out.result.dynamicHead - out.result.totalLoss)
    // 压力头差 = (3.1 - 0.48) * 98066.5 / 9806.65 = 2.62 × 10 ≈ 26.2m
    const passHeadDiff = headDiff > 25.5 && headDiff < 27.5
    const passTimeAlert = out.alerts.some((a) => a.alertType === '时间间隔')
    const pass = passDischarge && passSuction && passHeadDiff && passTimeAlert
    return { pass, detail:
      `修正生效: 排出压力=${out.effectiveParams.dischargePressure} (预期 3.1: ${passDischarge ? 'OK' : 'FAIL'}), ` +
      `冲突解决生效: 吸入压力=${out.effectiveParams.suctionPressure} (预期 0.48: ${passSuction ? 'OK' : 'FAIL'}), ` +
      `压力头差=${headDiff.toFixed(2)}m (预期 ~26.2m: ${passHeadDiff ? 'OK' : 'FAIL'}), ` +
      `时间告警=${passTimeAlert ? 'OK' : 'FAIL'}, 总扬程=${out.result.totalHead.toFixed(2)}m` }
  })

  // ========== 终端评估汇总 ==========
  const passed = reports.filter((r) => r.pass).length
  process.stdout.write(`\n\n==================================================\n`)
  process.stdout.write(`终端评估：${passed}/${reports.length} 通过\n`)
  process.stdout.write('==================================================\n')
  reports.forEach((r, i) => {
    process.stdout.write(`${r.pass ? '✅' : '❌'} 步骤 ${i + 1} - ${r.title}\n`)
    if (!r.pass) process.stdout.write(`   ${r.detail}\n`)
  })
  const allPass = passed === reports.length
  process.exit(allPass ? 0 : 1)
}

main()
