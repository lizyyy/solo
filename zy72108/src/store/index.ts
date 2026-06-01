import { create } from 'zustand'
import type { Batch, ThresholdVersion, StringName, StringMeasurement, ParameterSource } from '@/types'
import { INITIAL_THRESHOLDS, SAMPLE_BATCHES, uid } from '@/data/mockData'
import {
  detectAnomalies,
  detectConflicts,
  createAuditLog,
  createNewBatch,
  createParameterRecord,
  createMeasurement,
  createThresholdVersion,
} from '@/utils/reviewEngine'

interface ReviewStore {
  batches: Batch[]
  thresholdVersions: ThresholdVersion[]
  currentThreshold: () => ThresholdVersion
  getThresholdById: (id: string) => ThresholdVersion | undefined
  addBatch: (name: string) => Batch
  addParameterRecord: (
    batchId: string,
    source: ParameterSource,
    sourceDescription: string,
    measurements: { stringName: StringName; standardTension: number; measuredTension: number }[],
    environment?: { temperature: number; humidity: number; note: string }
  ) => void
  runAnomalyDetection: (batchId: string) => void
  runConflictDetection: (batchId: string) => void
  updateThreshold: (
    thresholds: Record<StringName, number>,
    changeReason: string,
    changedBy: string
  ) => void
  setBatchStatus: (batchId: string, status: Batch['status'], reason: string, actor: string) => void
  getBatchById: (batchId: string) => Batch | undefined
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  batches: SAMPLE_BATCHES,
  thresholdVersions: INITIAL_THRESHOLDS,

  currentThreshold: () => {
    const versions = get().thresholdVersions
    return versions[versions.length - 1]
  },

  getThresholdById: (id: string) => {
    return get().thresholdVersions.find((t) => t.id === id)
  },

  addBatch: (name: string) => {
    const batch = createNewBatch(name)
    const threshold = get().currentThreshold()
    const log = createAuditLog(
      batch.id,
      '创建批次',
      '林老师',
      threshold.id,
      threshold.version,
      '手动新建',
      name
    )
    batch.auditLogs.push(log)
    batch.status = 'reviewing'
    set((state) => ({ batches: [batch, ...state.batches] }))
    return batch
  },

  addParameterRecord: (batchId, source, sourceDescription, measurementData, environment) => {
    const measurements: StringMeasurement[] = measurementData.map((d) =>
      createMeasurement(d.stringName, d.standardTension, d.measuredTension)
    )
    const env = environment
      ? { id: uid(), recordId: '', temperature: environment.temperature, humidity: environment.humidity, note: environment.note }
      : null
    const record = createParameterRecord(batchId, source, sourceDescription, measurements, env)
    const threshold = get().currentThreshold()
    const log = createAuditLog(
      batchId,
      '导入参数',
      '林老师',
      threshold.id,
      threshold.version,
      source,
      sourceDescription
    )

    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId
          ? { ...b, parameterRecords: [...b.parameterRecords, record], auditLogs: [...b.auditLogs, log] }
          : b
      ),
    }))
  },

  runAnomalyDetection: (batchId: string) => {
    const batch = get().getBatchById(batchId)
    if (!batch) return
    const threshold = get().currentThreshold()
    const allAnomalousStrings: StringName[] = []

    const updatedRecords = batch.parameterRecords.map((record) => {
      if (record.measurements.length === 0) return record
      const updatedMeasurements = detectAnomalies(record.measurements, threshold)
      updatedMeasurements.forEach((m) => {
        if (m.isAnomaly) allAnomalousStrings.push(m.stringName)
      })
      return { ...record, measurements: updatedMeasurements }
    })

    const uniqueAnomalous = [...new Set(allAnomalousStrings)]
    const reasons = uniqueAnomalous
      .map((name) => {
        const m = updatedRecords
          .flatMap((r) => r.measurements)
          .find((m) => m.stringName === name && m.isAnomaly)
        return m?.anomalyReason
      })
      .filter(Boolean)

    const log = createAuditLog(
      batchId,
      uniqueAnomalous.length > 0 ? '标记异常' : '检测完成-无异常',
      '系统',
      threshold.id,
      threshold.version,
      '异常检测引擎',
      reasons.length > 0 ? reasons.join('；') : '所有弦偏差均在阈值范围内',
      { anomalousStrings: uniqueAnomalous }
    )

    const newStatus: Batch['status'] = uniqueAnomalous.length > 0 ? 'reviewing' : batch.status

    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId
          ? { ...b, parameterRecords: updatedRecords, auditLogs: [...b.auditLogs, log], status: newStatus }
          : b
      ),
    }))
  },

  runConflictDetection: (batchId: string) => {
    const batch = get().getBatchById(batchId)
    if (!batch) return
    const conflicts = detectConflicts(batch)
    if (conflicts.length === 0) return

    const threshold = get().currentThreshold()
    const log = createAuditLog(
      batchId,
      '检测到冲突',
      '系统',
      threshold.id,
      threshold.version,
      '系统自动检测',
      conflicts.map((c) => `${c.parameterName}：${c.importSource}与${c.inspectionSource}数据差异`).join('；'),
      { conflictCount: conflicts.length }
    )

    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId
          ? { ...b, conflicts: [...b.conflicts, ...conflicts], auditLogs: [...b.auditLogs, log] }
          : b
      ),
    }))
  },

  updateThreshold: (thresholds, changeReason, changedBy) => {
    const current = get().currentThreshold()
    const newVersion = createThresholdVersion(current.version, thresholds, changeReason, changedBy)
    createAuditLog(
      '',
      '更新阈值',
      changedBy,
      newVersion.id,
      newVersion.version,
      '阈值管理',
      changeReason,
      { oldVersion: current.version, newVersion: newVersion.version }
    )
    set((state) => ({
      thresholdVersions: [...state.thresholdVersions, newVersion],
    }))
  },

  setBatchStatus: (batchId, status, reason, actor) => {
    const threshold = get().currentThreshold()
    const actionLabel = status === 'passed' ? '判定通过' : status === 'anomaly' ? '判定异常' : '状态变更'
    const log = createAuditLog(
      batchId,
      actionLabel,
      actor,
      threshold.id,
      threshold.version,
      '人工判定',
      reason
    )
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId
          ? { ...b, status, auditLogs: [...b.auditLogs, log] }
          : b
      ),
    }))
  },

  getBatchById: (batchId: string) => {
    return get().batches.find((b) => b.id === batchId)
  },
}))
