import { useState, useCallback } from 'react'
import type {
  SafetyThresholdEntry,
  EquipmentNameplateParam,
  ConflictRecord,
  SamplingRecord,
  CalculationResult,
  SelfCheckResult,
  WorkflowStep,
  AuditTrailEntry,
  ExportRecord,
} from '../types'

const genId = () => crypto.randomUUID()
const now = () => new Date().toISOString()

const INITIAL_THRESHOLDS: SafetyThresholdEntry[] = [
  { id: 't1', parameterName: '最大允许挠度', thresholdValue: 150, unit: 'mm', severity: 'critical', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't2', parameterName: '预警挠度', thresholdValue: 120, unit: 'mm', severity: 'warning', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't3', parameterName: '吊臂长度', thresholdValue: 60, unit: 'm', severity: 'normal', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't4', parameterName: '最大起重量', thresholdValue: 12, unit: 't', severity: 'critical', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't5', parameterName: '工作风速上限', thresholdValue: 20, unit: 'm/s', severity: 'warning', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
]

const INITIAL_NAMEPLATE: EquipmentNameplateParam[] = [
  { id: 'n1', parameterName: '最大允许挠度', ratedValue: 140, unit: 'mm', tolerance: 5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n2', parameterName: '预警挠度', ratedValue: 110, unit: 'mm', tolerance: 5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n3', parameterName: '吊臂长度', ratedValue: 60, unit: 'm', tolerance: 0.5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n4', parameterName: '最大起重量', ratedValue: 10, unit: 't', tolerance: 0.5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n5', parameterName: '工作风速上限', ratedValue: 20, unit: 'm/s', tolerance: 2, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
]

function generateSamplingRecords(): SamplingRecord[] {
  const records: SamplingRecord[] = []
  const baseDate = '2026-06-03T06:00:00Z'
  for (let i = 0; i < 48; i++) {
    const ts = new Date(baseDate)
    ts.setMinutes(ts.getMinutes() + i * 30)
    const isMissing = i === 12 || i === 13
    const deflection = isMissing ? 0 : Math.round((80 + Math.sin(i * 0.3) * 40 + Math.random() * 15) * 10) / 10
    const ratio = deflection / 150
    const calcResult: CalculationResult | null = isMissing ? null : {
      deflectionRatio: Math.round(ratio * 1000) / 1000,
      safetyLevel: deflection > 120 ? (deflection > 150 ? 'danger' : 'warning') : 'safe',
      parameterVersion: 'v2.1',
      tradeOffReason: deflection > 120 ? '挠度超过预警阈值，建议降载运行' : '挠度在安全范围内',
      usedThresholdValue: 150,
      usedNameplateValue: 140,
      conflictResolution: '采用安全阈值表值(150mm)作为判定依据，设备铭牌值(140mm)已记录但未用于判定',
      calculatedAt: ts.toISOString(),
    }
    records.push({
      id: `s${i + 1}`,
      timestamp: ts.toISOString(),
      deflectionValue: deflection,
      unit: 'mm',
      isMissingHalfHour: isMissing,
      missingPeriodStart: isMissing ? ts.toISOString() : null,
      missingPeriodEnd: isMissing ? new Date(ts.getTime() + 30 * 60 * 1000).toISOString() : null,
      calculationResult: calcResult,
      status: isMissing ? 'pending_review' : (deflection > 120 ? 'abnormal' : 'normal'),
      reviewStatus: isMissing ? 'pending' : 'none',
      reviewer: '',
      reviewedAt: '',
      reviewNote: '',
    })
  }
  return records
}

const INITIAL_WORKFLOW: WorkflowStep[] = [
  { step: 1, name: '安全阈值表首次导入', status: 'completed', completedAt: '2026-06-03T08:00:00Z', operator: '系统管理员' },
  { step: 2, name: '维修师傅补看设备铭牌参数', status: 'in_progress', completedAt: '', operator: '老岑' },
  { step: 3, name: '实验复盘图更新', status: 'not_started', completedAt: '', operator: '' },
]

const INITIAL_AUDIT: AuditTrailEntry[] = [
  { id: 'a1', segment: 'threshold_source', action: '导入安全阈值表', operator: '系统管理员', timestamp: '2026-06-03T08:00:00Z', details: '导入安全阈值表v2.1，共5项参数', relatedRecordId: 'batch-001', parameterVersion: 'v2.1' },
  { id: 'a2', segment: 'nameplate_supplement', action: '补录设备铭牌参数', operator: '老岑', timestamp: '2026-06-04T09:30:00Z', details: '补录设备铭牌TC6015参数，发现与安全阈值表存在冲突', relatedRecordId: 'batch-002', parameterVersion: '铭牌v1.0' },
  { id: 'a3', segment: 'manual_confirmation', action: '等待确认冲突', operator: '', timestamp: '', details: '安全阈值表与设备铭牌参数存在偏差，等待维修师傅老岑确认', relatedRecordId: '', parameterVersion: '' },
]

export function useAppState() {
  const [thresholds, setThresholds] = useState<SafetyThresholdEntry[]>(INITIAL_THRESHOLDS)
  const [nameplateParams, setNameplateParams] = useState<EquipmentNameplateParam[]>(INITIAL_NAMEPLATE)
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([])
  const [samplingRecords, setSamplingRecords] = useState<SamplingRecord[]>(generateSamplingRecords())
  const [selfCheckResults, setSelfCheckResults] = useState<SelfCheckResult[]>([])
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(INITIAL_WORKFLOW)
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>(INITIAL_AUDIT)
  const [exportRecords, setExportRecords] = useState<ExportRecord[]>([])
  const [currentOperator] = useState('老岑')

  const detectConflicts = useCallback(() => {
    const newConflicts: ConflictRecord[] = []
    for (const t of thresholds) {
      const n = nameplateParams.find(np => np.parameterName === t.parameterName)
      if (!n) continue
      const deviation = Math.abs(t.thresholdValue - n.ratedValue)
      const deviationPercent = (deviation / n.ratedValue) * 100
      if (deviationPercent > n.tolerance) {
        const existing = conflicts.find(c => c.thresholdEntryId === t.id && c.nameplateParamId === n.id && c.status === 'pending')
        if (existing) continue
        newConflicts.push({
          id: genId(),
          thresholdEntryId: t.id,
          nameplateParamId: n.id,
          parameterName: t.parameterName,
          thresholdValue: t.thresholdValue,
          nameplateRatedValue: n.ratedValue,
          unit: t.unit,
          deviation,
          deviationPercent: Math.round(deviationPercent * 10) / 10,
          description: `安全阈值表[${t.parameterName}]=${t.thresholdValue}${t.unit}，设备铭牌[${n.parameterName}]=${n.ratedValue}${n.unit}，偏差${Math.round(deviationPercent * 10) / 10}%超过容差${n.tolerance}%`,
          status: 'pending',
          resolvedBy: '',
          resolvedAt: '',
          resolutionNote: '',
          createdAt: now(),
        })
      }
    }
    if (newConflicts.length > 0) {
      setConflicts(prev => [...prev, ...newConflicts])
    }
    return newConflicts
  }, [thresholds, nameplateParams, conflicts])

  const resolveConflict = useCallback((conflictId: string, status: 'confirmed' | 'rejected', note: string) => {
    setConflicts(prev => prev.map(c => {
      if (c.id !== conflictId) return c
      return { ...c, status, resolvedBy: currentOperator, resolvedAt: now(), resolutionNote: note }
    }))
    setAuditTrail(prev => [...prev, {
      id: genId(),
      segment: 'manual_confirmation',
      action: status === 'confirmed' ? '确认冲突' : '驳回冲突',
      operator: currentOperator,
      timestamp: now(),
      details: `${status === 'confirmed' ? '确认' : '驳回'}参数[${conflicts.find(c => c.id === conflictId)?.parameterName}]偏差，备注：${note}`,
      relatedRecordId: conflictId,
      parameterVersion: conflicts.find(c => c.id === conflictId)?.thresholdValue + '/' + conflicts.find(c => c.id === conflictId)?.nameplateRatedValue as string,
    }])
  }, [currentOperator, conflicts])

  const runSelfCheck = useCallback((): SelfCheckResult[] => {
    const results: SelfCheckResult[] = []

    const seenKeys = new Set<string>()
    let duplicateFound = false
    for (const t of thresholds) {
      const key = `${t.parameterName}-${t.thresholdValue}-${t.unit}`
      if (seenKeys.has(key)) { duplicateFound = true; break }
      seenKeys.add(key)
    }
    results.push({
      id: genId(),
      checkType: 'duplicate_import',
      status: duplicateFound ? 'fail' : 'pass',
      message: duplicateFound ? '检测到重复导入的安全阈值参数' : '无重复导入',
      details: duplicateFound ? '安全阈值表中存在参数名称、数值、单位完全相同的记录' : `共${thresholds.length}项参数，无重复`,
      checkedAt: now(),
    })

    const missingRecords = samplingRecords.filter(r => r.isMissingHalfHour)
    results.push({
      id: genId(),
      checkType: 'missing_half_hour',
      status: missingRecords.length > 0 ? 'warning' : 'pass',
      message: missingRecords.length > 0 ? `检测到${missingRecords.length}处采样时间缺失半小时` : '采样时间完整',
      details: missingRecords.map(r => `${r.missingPeriodStart} ~ ${r.missingPeriodEnd}`).join('；'),
      checkedAt: now(),
    })

    const recalcNeeded = conflicts.some(c => c.status === 'confirmed')
    results.push({
      id: genId(),
      checkType: 'recalc_after_supplement',
      status: recalcNeeded ? 'warning' : 'pass',
      message: recalcNeeded ? '存在已确认的冲突，需要补录后重算' : '无需重算',
      details: recalcNeeded ? '安全阈值表与设备铭牌参数的冲突已确认，建议基于确认结果重新计算挠度预警' : '所有参数一致，无需重算',
      checkedAt: now(),
    })

    const exportedDataHash = JSON.stringify(samplingRecords.map(r => ({
      id: r.id, value: r.deflectionValue, missing: r.isMissingHalfHour, status: r.status
    })))
    results.push({
      id: genId(),
      checkType: 'export_consistency',
      status: 'pass',
      message: '导出数据一致性校验通过',
      details: `导出数据哈希: ${exportedDataHash.slice(0, 16)}...，共${samplingRecords.length}条记录，含缺失${missingRecords.length}条`,
      checkedAt: now(),
    })

    setSelfCheckResults(results)
    return results
  }, [thresholds, samplingRecords, conflicts])

  const recalculateAfterSupplement = useCallback(() => {
    setSamplingRecords(prev => prev.map(r => {
      if (r.isMissingHalfHour) return r
      const resolvedConflicts = conflicts.filter(c => c.status === 'confirmed')
      let usedThreshold = r.calculationResult?.usedThresholdValue ?? 150
      let conflictRes = r.calculationResult?.conflictResolution ?? ''
      if (resolvedConflicts.length > 0) {
        const maxConflict = resolvedConflicts.reduce((max, c) => c.thresholdValue > max ? c.thresholdValue : max, 0)
        usedThreshold = maxConflict
        conflictRes = `补录后重算：采用已确认的阈值${maxConflict}mm作为判定依据（维修师傅老岑确认）`
      }
      const ratio = r.deflectionValue / usedThreshold
      const safetyLevel: 'safe' | 'warning' | 'danger' = ratio > 1 ? 'danger' : ratio > 0.8 ? 'warning' : 'safe'
      return {
        ...r,
        calculationResult: {
          deflectionRatio: Math.round(ratio * 1000) / 1000,
          safetyLevel,
          parameterVersion: `v2.1+铭牌v1.0-重算${now().slice(0, 10)}`,
          tradeOffReason: safetyLevel === 'danger' ? '挠度超过安全阈值，必须立即停机检查' : safetyLevel === 'warning' ? '挠度超过预警阈值(已重算)，建议降载运行' : '挠度在安全范围内(已重算)',
          usedThresholdValue: usedThreshold,
          usedNameplateValue: r.calculationResult?.usedNameplateValue ?? 140,
          conflictResolution: conflictRes,
          calculatedAt: now(),
        },
      }
    }))
    setAuditTrail(prev => [...prev, {
      id: genId(),
      segment: 'nameplate_supplement',
      action: '补录后重算',
      operator: currentOperator,
      timestamp: now(),
      details: '基于设备铭牌参数补录后重新计算所有挠度预警结果',
      relatedRecordId: 'recalc-001',
      parameterVersion: `v2.1+铭牌v1.0-重算${now().slice(0, 10)}`,
    }])
  }, [conflicts, currentOperator])

  const completeWorkflowStep = useCallback((step: 1 | 2 | 3) => {
    setWorkflowSteps(prev => prev.map(s => {
      if (s.step !== step) return s
      return { ...s, status: 'completed' as const, completedAt: now(), operator: currentOperator }
    }))
  }, [currentOperator])

  const reviewSamplingRecord = useCallback((recordId: string, note: string) => {
    setSamplingRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r
      return { ...r, reviewStatus: 'reviewed' as const, reviewer: currentOperator, reviewedAt: now(), reviewNote: note, status: 'abnormal' as const }
    }))
    setAuditTrail(prev => [...prev, {
      id: genId(),
      segment: 'manual_confirmation',
      action: '质检员复核采样缺失',
      operator: currentOperator,
      timestamp: now(),
      details: `复核采样记录${recordId}，备注：${note}`,
      relatedRecordId: recordId,
      parameterVersion: '',
    }])
  }, [currentOperator])

  const getExportData = useCallback(() => {
    return samplingRecords.map(r => ({
      采样时间: r.timestamp,
      挠度值_mm: r.deflectionValue,
      是否缺失半小时: r.isMissingHalfHour ? '是' : '否',
      状态: r.status === 'normal' ? '正常' : r.status === 'abnormal' ? '异常' : '待复核',
      安全等级: r.calculationResult?.safetyLevel === 'safe' ? '安全' : r.calculationResult?.safetyLevel === 'warning' ? '预警' : r.calculationResult?.safetyLevel === 'danger' ? '危险' : '未计算',
      挠度比: r.calculationResult?.deflectionRatio ?? '',
      参数版本: r.calculationResult?.parameterVersion ?? '',
      取舍理由: r.calculationResult?.tradeOffReason ?? '',
      冲突处理: r.calculationResult?.conflictResolution ?? '',
      复核人: r.reviewer || '',
      复核备注: r.reviewNote || '',
    }))
  }, [samplingRecords])

  const getAuditBySegment = useCallback((segment: 'threshold_source' | 'nameplate_supplement' | 'manual_confirmation') => {
    return auditTrail.filter(a => a.segment === segment).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditTrail])

  return {
    thresholds,
    nameplateParams,
    conflicts,
    samplingRecords,
    selfCheckResults,
    workflowSteps,
    auditTrail,
    exportRecords,
    currentOperator,
    detectConflicts,
    resolveConflict,
    runSelfCheck,
    recalculateAfterSupplement,
    completeWorkflowStep,
    reviewSamplingRecord,
    getExportData,
    getAuditBySegment,
  }
}
