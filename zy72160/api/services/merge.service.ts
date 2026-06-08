import db from '../database.js'
import { getImportJobsByBatch, getRawRecordsByJob, updateImportJobStatus } from '../repositories/import-job.repo.js'
import { createMergedPoint, getMergedPointsByBatch, updateMergedPointConflictStatus } from '../repositories/merged-point.repo.js'
import { createConflictItem, countUnresolvedConflicts } from '../repositories/conflict-item.repo.js'
import { createAnomaly, anomalyExists } from '../repositories/anomaly.repo.js'
import { createAuditLog } from '../repositories/audit-log.repo.js'
import type { MergedPoint, ConflictItem, Anomaly } from '../../shared/types.js'

export function mergeData(batchId: string, actor: string = 'system') {
  const existingPoints = getMergedPointsByBatch(batchId)
  const jobs = getImportJobsByBatch(batchId).filter(j => j.status === 'confirmed')
  if (jobs.length === 0) {
    throw new Error('No confirmed import jobs to merge')
  }

  const allRecords: { jobId: string; sourceType: string; fileName: string; importTime: string; mappedData: Record<string, unknown> }[] = []
  for (const job of jobs) {
    const records = getRawRecordsByJob(job.id)
    for (const r of records) {
      allRecords.push({
        jobId: job.id,
        sourceType: job.sourceType,
        fileName: job.fileName,
        importTime: job.importTime,
        mappedData: (r.mappedData || r.rawData) as Record<string, unknown>,
      })
    }
  }

  const conflicts: ConflictItem[] = []
  const anomalies: Anomaly[] = []
  let newCount = 0
  let matchedCount = 0

  const addressMap = new Map<string, MergedPoint>()
  for (const point of existingPoints) {
    const key = point.address.toLowerCase().trim()
    addressMap.set(key, point)
  }

  for (const record of allRecords) {
    const mapped = record.mappedData
    const address = String(mapped.address || mapped['地址'] || '').trim()
    if (!address) continue

    const gisId = String(mapped.gisId || mapped['gis_id'] || mapped['编号'] || '')
    const businessType = String(mapped.businessType || mapped['业态'] || '')
    const area = Number(mapped.area || mapped['面积'] || 0)

    const key = address.toLowerCase().trim()
    const existing = addressMap.get(key)

    if (existing) {
      matchedCount++
      const detectedConflicts = detectConflicts(existing, {
        businessType,
        area,
        gisSource: {
          sourceType: existing.sources.length > 0 ? existing.sources[0].sourceType : 'gis',
          fileName: existing.sources.length > 0 ? existing.sources[0].fileName : '',
          importTime: existing.sources.length > 0 ? existing.sources[0].importTime : '',
        },
        importSource: {
          sourceType: record.sourceType,
          fileName: record.fileName,
          importTime: record.importTime,
        },
      })

      for (const c of detectedConflicts) {
        const conflict = createConflictItem({
          mergedPointId: existing.id,
          fieldName: c.fieldName,
          gisValue: c.gisValue,
          importedValue: c.importedValue,
          gisSource: c.gisSource,
          importSource: c.importSource,
          suggestion: c.suggestion,
        })
        conflicts.push(conflict)
      }

      if (detectedConflicts.length > 0) {
        updateMergedPointConflictStatus(existing.id, 'conflict')
      }

      existing.sourceCount += 1
    } else {
      const newPoint = createMergedPoint({
        batchId,
        gisId,
        address,
        businessType,
        area,
        sourceCount: 1,
      })
      addressMap.set(key, newPoint)
      newCount++
    }
  }

  const mergedPoints = getMergedPointsByBatch(batchId)
  const detectedAnomalies = generateAnomalies(batchId, mergedPoints)
  for (const a of detectedAnomalies) {
    if (anomalyExists(a.mergedPointId, a.type)) continue
    const anomaly = createAnomaly(a)
    anomalies.push(anomaly)
  }

  createAuditLog({
    batchId,
    action: 'merge',
    actor,
    detail: `合并完成：新增 ${newCount} 个点位，匹配 ${matchedCount} 个点位，发现 ${conflicts.length} 个冲突，${anomalies.length} 个异常`,
    relatedId: batchId,
  })

  for (const job of jobs) {
    updateImportJobStatus(job.id, 'merged')
  }

  return {
    newCount,
    matchedCount,
    conflictCount: conflicts.length,
    anomalyCount: anomalies.length,
  }
}

export function detectConflicts(
  existingPoint: MergedPoint,
  importedData: {
    businessType: string
    area: number
    gisSource: any
    importSource: any
  }
): { fieldName: string; gisValue: string; importedValue: string; gisSource: any; importSource: any; suggestion: string }[] {
  const conflicts: { fieldName: string; gisValue: string; importedValue: string; gisSource: any; importSource: any; suggestion: string }[] = []

  if (existingPoint.businessType && importedData.businessType && existingPoint.businessType !== importedData.businessType) {
    conflicts.push({
      fieldName: 'businessType',
      gisValue: existingPoint.businessType,
      importedValue: importedData.businessType,
      gisSource: importedData.gisSource,
      importSource: importedData.importSource,
      suggestion: 'use_gis',
    })
  }

  if (existingPoint.area && importedData.area && existingPoint.area !== importedData.area) {
    conflicts.push({
      fieldName: 'area',
      gisValue: String(existingPoint.area),
      importedValue: String(importedData.area),
      gisSource: importedData.gisSource,
      importSource: importedData.importSource,
      suggestion: 'manual',
    })
  }

  return conflicts
}

export function generateAnomalies(
  batchId: string,
  mergedPoints: MergedPoint[]
): { mergedPointId: string; batchId: string; type: string; description: string; humanReadable: string }[] {
  const anomalies: { mergedPointId: string; batchId: string; type: string; description: string; humanReadable: string }[] = []

  const CAPACITY_LIMIT = 200

  for (const point of mergedPoints) {
    if (point.area > CAPACITY_LIMIT) {
      const excess = point.area - CAPACITY_LIMIT
      anomalies.push({
        mergedPointId: point.id,
        batchId,
        type: 'capacity_overlimit',
        description: `营业面积 ${point.area}㎡ 超出规划上限 ${CAPACITY_LIMIT}㎡，超出 ${excess}㎡`,
        humanReadable: `${point.address}的营业面积${point.area}㎡超出规划上限${excess}㎡`,
      })
    }
  }

  const addressCountMap = new Map<string, { pointId: string; count: number }>()
  for (const point of mergedPoints) {
    const key = point.address.toLowerCase().trim()
    const existing = addressCountMap.get(key)
    if (existing) {
      existing.count++
    } else {
      addressCountMap.set(key, { pointId: point.id, count: 1 })
    }
  }

  for (const [address, info] of addressCountMap) {
    if (info.count > 1) {
      const point = mergedPoints.find(p => p.id === info.pointId)
      anomalies.push({
        mergedPointId: info.pointId,
        batchId,
        type: 'time_period_conflict',
        description: `地址 ${address} 存在 ${info.count} 条不同时间段的数据记录`,
        humanReadable: `${point?.address || address}存在不同时间段数据冲突，共${info.count}条记录`,
      })
    }
  }

  return anomalies
}
