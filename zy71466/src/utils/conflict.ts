import type { TensileCurve, ConflictRecord } from '@/types'

export function detectConflicts(curves: TensileCurve[]): ConflictRecord[] {
  const conflicts: ConflictRecord[] = []

  const batchDevices: Record<string, Set<string>> = {}
  curves.forEach((c) => {
    if (!batchDevices[c.batchNo]) batchDevices[c.batchNo] = new Set()
    batchDevices[c.batchNo].add(c.deviceId)
  })

  Object.entries(batchDevices).forEach(([batchNo, devices]) => {
    if (devices.size > 2) {
      const batchCurves = curves.filter((c) => c.batchNo === batchNo)
      batchCurves.forEach((c) => {
        conflicts.push({
          curveId: c.id,
          sampleId: c.sampleId,
          conflictType: 'device_anomaly',
          description: `批次 ${batchNo} 涉及 ${devices.size} 台设备，可能存在设备批次混淆`,
          curveJudgment: '曲线形态待确认',
          metaJudgment: `批次${batchNo}跨设备: ${Array.from(devices).join(', ')}`,
          suggestion: '检查该批次样品是否在不同设备间流转，确认设备编号记录是否正确',
          severity: 'warning',
        })
      })
    }
  })

  const deviceBatches: Record<string, Set<string>> = {}
  curves.forEach((c) => {
    if (!deviceBatches[c.deviceId]) deviceBatches[c.deviceId] = new Set()
    deviceBatches[c.deviceId].add(c.batchNo)
  })

  Object.entries(deviceBatches).forEach(([deviceId, batches]) => {
    if (batches.size > 3) {
      const deviceCurves = curves.filter((c) => c.deviceId === deviceId)
      deviceCurves.forEach((c) => {
        conflicts.push({
          curveId: c.id,
          sampleId: c.sampleId,
          conflictType: 'batch_mismatch',
          description: `设备 ${deviceId} 覆盖 ${batches.size} 个批次，批次边界可能模糊`,
          curveJudgment: '曲线归属待确认',
          metaJudgment: `设备${deviceId}跨批次: ${Array.from(batches).join(', ')}`,
          suggestion: '核实该设备在多个批次间是否存在样品混放或编号重复',
          severity: 'warning',
        })
      })
    }
  })

  curves.forEach((c) => {
    if (!c.isAnomaly || !c.fractureType) return

    const sameBatchCurves = curves.filter((o) => o.batchNo === c.batchNo && o.id !== c.id)
    if (sameBatchCurves.length === 0) return

    const normalSameBatch = sameBatchCurves.filter((o) => !o.isAnomaly)
    const dominantFracture = normalSameBatch.length > 0
      ? getDominantFracture(normalSameBatch)
      : getDominantFracture(sameBatchCurves)

    if (dominantFracture && dominantFracture !== c.fractureType) {
      conflicts.push({
        curveId: c.id,
        sampleId: c.sampleId,
        conflictType: 'curve_batch_conflict',
        description: `样品 ${c.sampleId} 断裂形态(${c.fractureType})与同批次主流形态(${dominantFracture})不一致`,
        curveJudgment: `曲线显示${c.fractureType}断裂`,
        metaJudgment: `批次${c.batchNo}主流为${dominantFracture}断裂`,
        suggestion: '确认样品是否归错批次，或该样品确实存在特殊断裂行为',
        severity: 'error',
      })
    }
  })

  return conflicts
}

function getDominantFracture(curves: TensileCurve[]): string | null {
  const counts: Record<string, number> = {}
  curves.forEach((c) => {
    const ft = c.fractureType || '未知'
    counts[ft] = (counts[ft] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted.length > 0 ? sorted[0][0] : null
}
