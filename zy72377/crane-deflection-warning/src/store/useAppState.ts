import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  ImportBatch,
  SafetyThresholdEntry,
  EquipmentNameplateParam,
  ConflictRecord,
  SamplingRecord,
  CalculationResult,
  SelfCheckResult,
  WorkflowStep,
  AuditTrailEntry,
  BeforeAfterSnapshot,
  UnifiedResultRow,
} from '../types'

const genId = () => crypto.randomUUID()
const now = () => new Date().toISOString()

const BATCH_THRESHOLD_1 = 'batch-threshold-001'
const BATCH_NAMEPLATE_1 = 'batch-nameplate-001'
const BATCH_SAMPLING_1 = 'batch-sampling-001'

const INITIAL_BATCHES: ImportBatch[] = [
  { id: BATCH_THRESHOLD_1, label: '安全阈值表v2.1-首次导入', type: 'threshold', importedAt: '2026-06-03T08:00:00Z', operator: '系统管理员', recordCount: 5, checksum: 'sha256:a1b2c3' },
  { id: BATCH_NAMEPLATE_1, label: '设备铭牌TC6015-补录', type: 'nameplate', importedAt: '2026-06-04T09:30:00Z', operator: '老岑', recordCount: 5, checksum: 'sha256:d4e5f6' },
  { id: BATCH_SAMPLING_1, label: '采样数据2026-06-03', type: 'sampling', importedAt: '2026-06-03T06:00:00Z', operator: '数据采集系统', recordCount: 48, checksum: 'sha256:g7h8i9' },
]

const INITIAL_THRESHOLDS: SafetyThresholdEntry[] = [
  { id: 't1', batchId: BATCH_THRESHOLD_1, parameterName: '最大允许挠度', thresholdValue: 150, unit: 'mm', severity: 'critical', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't2', batchId: BATCH_THRESHOLD_1, parameterName: '预警挠度', thresholdValue: 120, unit: 'mm', severity: 'warning', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't3', batchId: BATCH_THRESHOLD_1, parameterName: '吊臂长度', thresholdValue: 60, unit: 'm', severity: 'normal', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't4', batchId: BATCH_THRESHOLD_1, parameterName: '最大起重量', thresholdValue: 12, unit: 't', severity: 'critical', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
  { id: 't5', batchId: BATCH_THRESHOLD_1, parameterName: '工作风速上限', thresholdValue: 20, unit: 'm/s', severity: 'warning', source: '安全阈值表v2.1', importedAt: '2026-06-03T08:00:00Z', parameterVersion: 'v2.1' },
]

const INITIAL_NAMEPLATE: EquipmentNameplateParam[] = [
  { id: 'n1', batchId: BATCH_NAMEPLATE_1, parameterName: '最大允许挠度', ratedValue: 140, unit: 'mm', tolerance: 5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n2', batchId: BATCH_NAMEPLATE_1, parameterName: '预警挠度', ratedValue: 110, unit: 'mm', tolerance: 5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n3', batchId: BATCH_NAMEPLATE_1, parameterName: '吊臂长度', ratedValue: 60, unit: 'm', tolerance: 0.5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n4', batchId: BATCH_NAMEPLATE_1, parameterName: '最大起重量', ratedValue: 10, unit: 't', tolerance: 0.5, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
  { id: 'n5', batchId: BATCH_NAMEPLATE_1, parameterName: '工作风速上限', ratedValue: 20, unit: 'm/s', tolerance: 2, source: '设备铭牌TC6015', importedAt: '2026-06-04T09:30:00Z', parameterVersion: '铭牌v1.0' },
]

function generateSamplingRecords(): SamplingRecord[] {
  const records: SamplingRecord[] = []
  const baseDate = '2026-06-03T06:00:00Z'
  for (let i = 0; i < 48; i++) {
    const ts = new Date(baseDate)
    ts.setMinutes(ts.getMinutes() + i * 30)
    const isMissing = i === 12 || i === 13
    const deflection = isMissing ? 0 : Math.round((80 + Math.sin(i * 0.3) * 40 + (i % 7) * 2.1) * 10) / 10
    const ratio = deflection / 150
    const calcResult: CalculationResult | null = isMissing ? null : {
      deflectionRatio: Math.round(ratio * 1000) / 1000,
      safetyLevel: deflection > 120 ? (deflection > 150 ? 'danger' : 'warning') : 'safe',
      parameterVersion: 'v2.1',
      tradeOffReason: deflection > 120 ? '挠度超过预警阈值，建议降载运行' : '挠度在安全范围内',
      usedThresholdValue: 150,
      usedNameplateValue: 0,
      conflictResolution: '首次导入，仅使用安全阈值表值(150mm)，设备铭牌参数尚未补录',
      calculatedAt: ts.toISOString(),
    }
    records.push({
      id: `s${i + 1}`,
      batchId: BATCH_SAMPLING_1,
      timestamp: ts.toISOString(),
      deflectionValue: deflection,
      unit: 'mm',
      isMissingHalfHour: isMissing,
      missingPeriodStart: isMissing ? ts.toISOString() : null,
      missingPeriodEnd: isMissing ? new Date(ts.getTime() + 30 * 60 * 1000).toISOString() : null,
      missingSource: isMissing ? '采样数据2026-06-03-采集系统中断' : '',
      calculationResult: calcResult,
      status: isMissing ? 'pending_review' : (deflection > 120 ? 'abnormal' : 'normal'),
      reviewStatus: isMissing ? 'pending' : 'none',
      reviewer: '',
      reviewedAt: '',
      reviewNote: '',
      beforeAfterSnapshots: [],
    })
  }
  return records
}

function computeInitialConflicts(
  thresholds: SafetyThresholdEntry[],
  nameplateParams: EquipmentNameplateParam[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = []
  for (const t of thresholds) {
    const n = nameplateParams.find(np => np.parameterName === t.parameterName)
    if (!n) continue
    const deviation = Math.abs(t.thresholdValue - n.ratedValue)
    const deviationPercent = (deviation / n.ratedValue) * 100
    if (deviationPercent > n.tolerance) {
      conflicts.push({
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
        createdAt: '2026-06-04T09:30:00Z',
      })
    }
  }
  return conflicts
}

const INITIAL_CONFLICTS = computeInitialConflicts(INITIAL_THRESHOLDS, INITIAL_NAMEPLATE)

const INITIAL_WORKFLOW: WorkflowStep[] = [
  { step: 1, name: '安全阈值表首次导入', status: 'completed', completedAt: '2026-06-03T08:00:00Z', operator: '系统管理员' },
  { step: 2, name: '维修师傅补看设备铭牌参数', status: 'in_progress', completedAt: '', operator: '老岑' },
  { step: 3, name: '实验复盘图更新', status: 'not_started', completedAt: '', operator: '' },
]

const INITIAL_AUDIT: AuditTrailEntry[] = [
  { id: 'a1', segment: 'threshold_source', action: '导入安全阈值表', operator: '系统管理员', timestamp: '2026-06-03T08:00:00Z', details: '导入安全阈值表v2.1，共5项参数，批次号batch-threshold-001', relatedRecordId: BATCH_THRESHOLD_1, parameterVersion: 'v2.1', batchId: BATCH_THRESHOLD_1 },
  { id: 'a2', segment: 'nameplate_supplement', action: '补录设备铭牌参数', operator: '老岑', timestamp: '2026-06-04T09:30:00Z', details: '补录设备铭牌TC6015参数，发现与安全阈值表存在冲突，批次号batch-nameplate-001', relatedRecordId: BATCH_NAMEPLATE_1, parameterVersion: '铭牌v1.0', batchId: BATCH_NAMEPLATE_1 },
]

export function useAppState() {
  const [batches, setBatches] = useState<ImportBatch[]>(INITIAL_BATCHES)
  const [thresholds, setThresholds] = useState<SafetyThresholdEntry[]>(INITIAL_THRESHOLDS)
  const [nameplateParams, setNameplateParams] = useState<EquipmentNameplateParam[]>(INITIAL_NAMEPLATE)
  const [conflicts, setConflicts] = useState<ConflictRecord[]>(INITIAL_CONFLICTS)
  const [samplingRecords, setSamplingRecords] = useState<SamplingRecord[]>(generateSamplingRecords())
  const [selfCheckResults, setSelfCheckResults] = useState<SelfCheckResult[]>([])
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(INITIAL_WORKFLOW)
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>(INITIAL_AUDIT)
  const [currentOperator] = useState('老岑')

  const reimportThresholds = useCallback((label: string) => {
    const existingChecksum = batches.find(b => b.type === 'threshold')?.checksum
    const newChecksum = `sha256:${Math.random().toString(36).slice(2, 8)}`
    const isDuplicateReimport = existingChecksum === newChecksum

    const seenKeys = new Set(thresholds.map(t => `${t.parameterName}-${t.thresholdValue}-${t.unit}`))
    let duplicateCount = 0
    for (const t of INITIAL_THRESHOLDS) {
      const key = `${t.parameterName}-${t.thresholdValue}-${t.unit}`
      if (seenKeys.has(key)) {
        duplicateCount++
      }
    }

    if (duplicateCount === INITIAL_THRESHOLDS.length) {
      const newBatch: ImportBatch = {
        id: `batch-threshold-${Date.now()}`,
        label: `${label}-重传(被拦截)`,
        type: 'threshold',
        importedAt: now(),
        operator: currentOperator,
        recordCount: 0,
        checksum: newChecksum,
      }
      setBatches(prev => [...prev, newBatch])
      setAuditTrail(prev => [...prev, {
        id: genId(),
        segment: 'threshold_source',
        action: '重传安全阈值表(被拦截)',
        operator: currentOperator,
        timestamp: now(),
        details: `重传安全阈值表被拦截：${duplicateCount}项参数与现有数据完全重复，尤其是采样时间缺了半小时这种记录未多出一份。批次号${newBatch.id}`,
        relatedRecordId: newBatch.id,
        parameterVersion: 'v2.1',
        batchId: newBatch.id,
      }])
      return { success: false, reason: `${duplicateCount}项参数完全重复，重传被拦截` }
    }

    const newBatch: ImportBatch = {
      id: `batch-threshold-${Date.now()}`,
      label,
      type: 'threshold',
      importedAt: now(),
      operator: currentOperator,
      recordCount: INITIAL_THRESHOLDS.length,
      checksum: newChecksum,
    }
    setBatches(prev => [...prev, newBatch])
    setThresholds(prev => [...prev, ...INITIAL_THRESHOLDS.map(t => ({ ...t, id: genId(), batchId: newBatch.id, importedAt: now() }))])
    setAuditTrail(prev => [...prev, {
      id: genId(),
      segment: 'threshold_source',
      action: '导入安全阈值表(增量)',
      operator: currentOperator,
      timestamp: now(),
      details: `增量导入安全阈值表，批次号${newBatch.id}`,
      relatedRecordId: newBatch.id,
      parameterVersion: 'v2.1',
      batchId: newBatch.id,
    }])
    return { success: true, reason: '增量导入成功' }
  }, [batches, thresholds, currentOperator])

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
      details: `${status === 'confirmed' ? '确认' : '驳回'}参数偏差，备注：${note}`,
      relatedRecordId: conflictId,
      parameterVersion: '',
      batchId: '',
    }])
  }, [currentOperator])

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
      details: duplicateFound ? '安全阈值表中存在参数名称、数值、单位完全相同的记录' : `共${thresholds.length}项参数，${batches.filter(b => b.type === 'threshold').length}个批次，无重复`,
      checkedAt: now(),
    })

    const missingRecords = samplingRecords.filter(r => r.isMissingHalfHour)
    results.push({
      id: genId(),
      checkType: 'missing_half_hour',
      status: missingRecords.length > 0 ? 'warning' : 'pass',
      message: missingRecords.length > 0 ? `检测到${missingRecords.length}处采样时间缺失半小时` : '采样时间完整',
      details: missingRecords.map(r => `${r.missingPeriodStart} ~ ${r.missingPeriodEnd} (来源:${r.missingSource})`).join('；'),
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

    const pageStatuses = samplingRecords.map(r => r.status)
    const exportStatuses = samplingRecords.map(r => r.isMissingHalfHour ? 'pending_review' : r.status)
    const consistent = pageStatuses.every((s, i) => s === exportStatuses[i])
    results.push({
      id: genId(),
      checkType: 'export_consistency',
      status: consistent ? 'pass' : 'fail',
      message: consistent ? '导出数据一致性校验通过' : '导出数据与页面展示不一致',
      details: `共${samplingRecords.length}条记录，含缺失${missingRecords.length}条，三端一致=${consistent}`,
      checkedAt: now(),
    })

    setSelfCheckResults(results)
    return results
  }, [thresholds, samplingRecords, conflicts, batches])

  const recalculateAfterSupplement = useCallback(() => {
    const resolvedConflicts = conflicts.filter(c => c.status === 'confirmed')
    const ts = now()

    setSamplingRecords(prev => prev.map(r => {
      if (r.isMissingHalfHour) return r

      const beforeCalc = r.calculationResult
      let usedThreshold = beforeCalc?.usedThresholdValue ?? 150
      let conflictRes = beforeCalc?.conflictResolution ?? ''
      if (resolvedConflicts.length > 0) {
        const maxConflict = resolvedConflicts.reduce((max, c) => c.thresholdValue > max ? c.thresholdValue : max, 0)
        usedThreshold = maxConflict
        conflictRes = `补录后重算：采用已确认的阈值${maxConflict}mm作为判定依据（维修师傅${currentOperator}确认）`
      }
      const ratio = r.deflectionValue / usedThreshold
      const safetyLevel: 'safe' | 'warning' | 'danger' = ratio > 1 ? 'danger' : ratio > 0.8 ? 'warning' : 'safe'

      const snapshots: BeforeAfterSnapshot[] = [...r.beforeAfterSnapshots]
      if (beforeCalc) {
        snapshots.push({
          field: 'calculationResult',
          before: JSON.stringify({ safetyLevel: beforeCalc.safetyLevel, deflectionRatio: beforeCalc.deflectionRatio, parameterVersion: beforeCalc.parameterVersion, tradeOffReason: beforeCalc.tradeOffReason, conflictResolution: beforeCalc.conflictResolution }),
          after: JSON.stringify({ safetyLevel, deflectionRatio: Math.round(ratio * 1000) / 1000, parameterVersion: `v2.1+铭牌v1.0-重算`, tradeOffReason: safetyLevel === 'danger' ? '挠度超过安全阈值，必须立即停机检查' : safetyLevel === 'warning' ? '挠度超过预警阈值(已重算)，建议降载运行' : '挠度在安全范围内(已重算)', conflictResolution: conflictRes }),
          changedAt: ts,
          changedBy: currentOperator,
        })
      }

      const beforeStatus = r.status
      const afterStatus: 'normal' | 'abnormal' = safetyLevel !== 'safe' ? 'abnormal' : 'normal'
      if (beforeStatus !== afterStatus) {
        snapshots.push({
          field: 'status',
          before: beforeStatus,
          after: afterStatus,
          changedAt: ts,
          changedBy: currentOperator,
        })
      }

      return {
        ...r,
        status: afterStatus,
        calculationResult: {
          deflectionRatio: Math.round(ratio * 1000) / 1000,
          safetyLevel,
          parameterVersion: `v2.1+铭牌v1.0-重算`,
          tradeOffReason: safetyLevel === 'danger' ? '挠度超过安全阈值，必须立即停机检查' : safetyLevel === 'warning' ? '挠度超过预警阈值(已重算)，建议降载运行' : '挠度在安全范围内(已重算)',
          usedThresholdValue: usedThreshold,
          usedNameplateValue: 140,
          conflictResolution: conflictRes,
          calculatedAt: ts,
        },
        beforeAfterSnapshots: snapshots,
      }
    }))

    setAuditTrail(prev => [...prev, {
      id: genId(),
      segment: 'nameplate_supplement',
      action: '补录后重算',
      operator: currentOperator,
      timestamp: ts,
      details: '基于设备铭牌参数补录后重新计算所有挠度预警结果，改前/改后内容已记录在 beforeAfterSnapshots',
      relatedRecordId: 'recalc-001',
      parameterVersion: `v2.1+铭牌v1.0-重算`,
      batchId: BATCH_NAMEPLATE_1,
    }])
  }, [conflicts, currentOperator])

  const completeWorkflowStep = useCallback((step: 1 | 2 | 3) => {
    setWorkflowSteps(prev => prev.map(s => {
      if (s.step !== step) return s
      return { ...s, status: 'completed' as const, completedAt: now(), operator: currentOperator }
    }))
  }, [currentOperator])

  const reviewSamplingRecord = useCallback((recordId: string, note: string) => {
    const ts = now()
    setSamplingRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r
      const snapshots: BeforeAfterSnapshot[] = [...r.beforeAfterSnapshots, {
        field: 'reviewStatus',
        before: r.reviewStatus,
        after: 'reviewed',
        changedAt: ts,
        changedBy: currentOperator,
      }, {
        field: 'status',
        before: r.status,
        after: 'abnormal',
        changedAt: ts,
        changedBy: currentOperator,
      }]
      return { ...r, reviewStatus: 'reviewed' as const, reviewer: currentOperator, reviewedAt: ts, reviewNote: note, status: 'abnormal' as const, beforeAfterSnapshots: snapshots }
    }))
    setAuditTrail(prev => [...prev, {
      id: genId(),
      segment: 'manual_confirmation',
      action: '质检员复核采样缺失',
      operator: currentOperator,
      timestamp: ts,
      details: `复核采样记录${recordId}，备注：${note}。改前/改后已记录`,
      relatedRecordId: recordId,
      parameterVersion: '',
      batchId: '',
    }])
  }, [currentOperator])

  const getExportData = useCallback((): UnifiedResultRow[] => {
    return samplingRecords.map(r => ({
      recordId: r.id,
      samplingTime: r.timestamp,
      deflectionValue: r.deflectionValue,
      unit: r.unit,
      isMissingHalfHour: r.isMissingHalfHour,
      missingSource: r.missingSource,
      missingPeriod: r.isMissingHalfHour ? `${r.missingPeriodStart}~${r.missingPeriodEnd}` : '',
      status: r.status,
      reviewStatus: r.reviewStatus,
      reviewer: r.reviewer,
      reviewNote: r.reviewNote,
      safetyLevel: r.calculationResult?.safetyLevel ?? '',
      deflectionRatio: r.calculationResult?.deflectionRatio ?? 0,
      parameterVersion: r.calculationResult?.parameterVersion ?? '',
      tradeOffReason: r.calculationResult?.tradeOffReason ?? '',
      conflictResolution: r.calculationResult?.conflictResolution ?? '',
      beforeAfterSnapshots: r.beforeAfterSnapshots,
    }))
  }, [samplingRecords])

  const getAuditBySegment = useCallback((segment: 'threshold_source' | 'nameplate_supplement' | 'manual_confirmation') => {
    return auditTrail.filter(a => a.segment === segment).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditTrail])

  return {
    batches,
    thresholds,
    nameplateParams,
    conflicts,
    samplingRecords,
    selfCheckResults,
    workflowSteps,
    auditTrail,
    currentOperator,
    reimportThresholds,
    resolveConflict,
    runSelfCheck,
    recalculateAfterSupplement,
    completeWorkflowStep,
    reviewSamplingRecord,
    getExportData,
    getAuditBySegment,
  }
}
