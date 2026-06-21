import { create } from 'zustand'
import type {
  UnifiedRecord,
  AllocationParams,
  AllocationResult,
  CalcStep,
  Conflict,
  ConflictResolution,
  AuditLogEntry,
  DataSource,
  FieldMapping,
  UnitConversion,
} from '@/types'
import { db, addAuditLog } from '@/db'
import { convertValue } from '@/utils/unitConversion'

interface AppStore {
  dataSources: DataSource[]
  records: UnifiedRecord[]
  fieldMappings: FieldMapping[]
  unitConversions: UnitConversion[]
  params: AllocationParams[]
  results: AllocationResult[]
  calcSteps: CalcStep[]
  conflicts: Conflict[]
  resolutions: ConflictResolution[]
  auditLog: AuditLogEntry[]
  currentParamVersionId: number | null
  selectedResultId: number | null
  selectedDetailRow: number | null

  loadData: () => Promise<void>
  addDataSource: (ds: Omit<DataSource, 'id'>) => Promise<number>
  addRecords: (recs: Omit<UnifiedRecord, 'id'>[]) => Promise<UnifiedRecord[]>
  updateRecord: (id: number, changes: Partial<UnifiedRecord>) => Promise<void>
  reprocessRecordsBySource: (
    sourceId: number,
    fieldMap: Record<string, string>,
    unitConvs: Record<string, { from: string; to: string }>,
    parsedHeaders: { originalHeader: string; fieldName: string; detectedUnit: string | null; detectedStdField: string | null }[],
  ) => Promise<number>
  addFieldMapping: (mapping: Omit<FieldMapping, 'id'>) => Promise<void>
  addUnitConversion: (conv: Omit<UnitConversion, 'id'>) => Promise<void>
  saveParamVersion: (params: Omit<AllocationParams, 'id' | 'createdAt' | 'versionLabel'>, label?: string) => Promise<number>
  setCurrentParamVersion: (id: number) => void
  runAllocation: (paramVersionId: number) => Promise<void>
  toggleAnomaly: (recordId: number, included: boolean) => Promise<void>
  detectConflicts: () => Promise<void>
  resolveConflict: (conflictId: number, resolution: Omit<ConflictResolution, 'id'>) => Promise<void>
  setSelectedResultId: (id: number | null) => void
  setSelectedDetailRow: (id: number | null) => void
  exportAuditLog: () => AuditLogEntry[]
  addAuditLog: (category: AuditLogEntry['category'], action: string, detail: string, relatedId?: string) => Promise<void>
  clearAllData: () => Promise<void>
}

export const useStore = create<AppStore>((set, get) => ({
  dataSources: [],
  records: [],
  fieldMappings: [],
  unitConversions: [],
  params: [],
  results: [],
  calcSteps: [],
  conflicts: [],
  resolutions: [],
  auditLog: [],
  currentParamVersionId: null,
  selectedResultId: null,
  selectedDetailRow: null,

  loadData: async () => {
    const [
      dataSources,
      records,
      fieldMappings,
      unitConversions,
      params,
      results,
      calcSteps,
      conflicts,
      resolutions,
      auditLog,
    ] = await Promise.all([
      db.dataSources.toArray(),
      db.unifiedRecords.toArray(),
      db.fieldMappings.toArray(),
      db.unitConversions.toArray(),
      db.allocationParams.toArray(),
      db.allocationResults.toArray(),
      db.calcSteps.toArray(),
      db.conflicts.toArray(),
      db.conflictResolutions.toArray(),
      db.auditLog.toArray(),
    ])
    set({
      dataSources,
      records,
      fieldMappings,
      unitConversions,
      params,
      results,
      calcSteps,
      conflicts,
      resolutions,
      auditLog,
    })
    const latestParam = params.length > 0 ? params[params.length - 1] : null
    if (latestParam?.id) {
      set({ currentParamVersionId: latestParam.id })
    }
  },

  addDataSource: async (ds) => {
    const id = await db.dataSources.add(ds as DataSource)
    await addAuditLog('data', '导入数据源', `类型: ${ds.type}, 名称: ${ds.name}`, String(id))
    set((s) => ({ dataSources: [...s.dataSources, { ...ds, id }] }))
    return id
  },

  addRecords: async (recs) => {
    const ids = await db.unifiedRecords.bulkAdd(recs as UnifiedRecord[])
    await addAuditLog('data', '添加记录', `共 ${recs.length} 条`, '')
    const inserted = recs.map((r, i) => ({
      ...r,
      id: Array.isArray(ids) ? (ids[i] as number) : (ids as number) + i,
    }))
    set((s) => ({ records: [...s.records, ...inserted] }))
    return inserted
  },

  updateRecord: async (id, changes) => {
    await db.unifiedRecords.update(id, changes)
    await addAuditLog('data', '更新记录', `ID: ${id}`, String(id))
    set((s) => ({
      records: s.records.map((r) => (r.id === id ? { ...r, ...changes } : r)),
    }))
  },

  reprocessRecordsBySource: async (sourceId, fieldMap, unitConvs, parsedHeaders) => {
    const sourceRecords = await db.unifiedRecords.where('dataSourceId').equals(sourceId).toArray()
    if (sourceRecords.length === 0) return 0

    const NUMERIC_FIELDS = ['temperature', 'mileage', 'vehicleCapacity']

    for (const rec of sourceRecords) {
      const origVals: Record<string, string> = {}
      const headers = rec.originalFieldName.split(',')
      const values = rec.originalValue.split(',')
      headers.forEach((h, i) => { origVals[h] = values[i] || '' })

      const getMappedValue = (stdField: string) => {
        const origHeader = Object.entries(fieldMap).find(([, v]) => v === stdField)?.[0]
        return origHeader ? origVals[origHeader] : ''
      }

      const tempRaw = parseFloat(getMappedValue('temperature')) || 0
      const mileageRaw = parseFloat(getMappedValue('mileage')) || 0
      const capacityRaw = parseFloat(getMappedValue('vehicleCapacity')) || 0

      const tempConv = unitConvs.temperature
        ? convertValue(tempRaw, 'temperature', unitConvs.temperature.from, unitConvs.temperature.to)
        : tempRaw
      const mileageConv = unitConvs.mileage
        ? convertValue(mileageRaw, 'mileage', unitConvs.mileage.from, unitConvs.mileage.to)
        : mileageRaw
      const capacityConv = unitConvs.vehicleCapacity
        ? convertValue(capacityRaw, 'vehicleCapacity', unitConvs.vehicleCapacity.from, unitConvs.vehicleCapacity.to)
        : capacityRaw

      const isTempAnomaly = tempConv > 0 || tempConv < -60
      const isMileageAnomaly = mileageConv < 0 || mileageConv > 2000
      const isCapacityAnomaly = capacityConv < 0 || capacityConv > 100
      const isAnomaly = isTempAnomaly || isMileageAnomaly || isCapacityAnomaly
      const anomalyReason = [
        isTempAnomaly ? `温度异常(${tempConv}°C)` : '',
        isMileageAnomaly ? `里程异常(${mileageConv}km)` : '',
        isCapacityAnomaly ? `容量异常(${capacityConv}吨)` : '',
      ].filter(Boolean).join('；')

      const stdFields = Object.values(fieldMap).filter(Boolean).join(',')
      const origUnits = parsedHeaders.map((p) => p.detectedUnit || '').filter(Boolean).join(',')

      await db.unifiedRecords.update(rec.id!, {
        standardFieldName: stdFields,
        originalUnit: origUnits,
        convertedValue: tempConv,
        targetUnit: '℃',
        isAnomaly,
        anomalyReason,
        routeId: getMappedValue('routeId') || rec.routeId,
        warehouseId: getMappedValue('warehouseId') || rec.warehouseId,
        temperature: tempConv,
        mileage: mileageConv,
        vehicleCapacity: capacityConv,
      })
    }

    await addAuditLog('data', '重新映射字段并重处理', `数据源ID: ${sourceId}, 共 ${sourceRecords.length} 条`, String(sourceId))
    await get().loadData()
    return sourceRecords.length
  },

  addFieldMapping: async (mapping) => {
    await db.fieldMappings.add(mapping as FieldMapping)
    await addAuditLog('data', '保存字段映射', `${mapping.originalField} → ${mapping.standardField}`, '')
    set((s) => ({ fieldMappings: [...s.fieldMappings, { ...mapping, id: s.fieldMappings.length + 1 }] }))
  },

  addUnitConversion: async (conv) => {
    await db.unitConversions.add(conv as UnitConversion)
    await addAuditLog('data', '保存单位换算', `${conv.fromUnit} → ${conv.toUnit}, 系数: ${conv.factor}`, '')
    set((s) => ({ unitConversions: [...s.unitConversions, { ...conv, id: s.unitConversions.length + 1 }] }))
  },

  saveParamVersion: async (p, label) => {
    const count = await db.allocationParams.count()
    const versionLabel = label || `V${count + 1}`
    const entry: Omit<AllocationParams, 'id'> = {
      ...p,
      versionLabel,
      createdAt: new Date().toISOString(),
    }
    const id = await db.allocationParams.add(entry as AllocationParams)
    await addAuditLog('parameter', '保存参数版本', `${versionLabel}: 温区[${p.tempZoneMin},${p.tempZoneMax}], 里程上限:${p.maxMileage}, 容量:${p.vehicleCapacity}`, String(id))
    set((s) => ({
      params: [...s.params, { ...entry, id }],
      currentParamVersionId: id,
    }))
    return id
  },

  setCurrentParamVersion: (id) => set({ currentParamVersionId: id }),

  runAllocation: async (paramVersionId) => {
    const param = await db.allocationParams.get(paramVersionId)
    if (!param) return

    const allRecords = await db.unifiedRecords.toArray()
    const activeRecords = allRecords.filter((r) => !r.isAnomaly)
    await addAuditLog('calculation', '开始路线分配', `参数版本: ${param.versionLabel}, 活跃记录: ${activeRecords.length}`, String(paramVersionId))

    const routeMap = new Map<string, UnifiedRecord[]>()
    for (const r of activeRecords) {
      const key = r.routeId || 'UNKNOWN'
      if (!routeMap.has(key)) routeMap.set(key, [])
      routeMap.get(key)!.push(r)
    }

    const newResults: Omit<AllocationResult, 'id'>[] = []
    const newSteps: Omit<CalcStep, 'id'>[] = []
    let stepOrder = 0

    for (const [routeId, recs] of routeMap) {
      const whMap = new Map<string, UnifiedRecord[]>()
      for (const r of recs) {
        const key = r.warehouseId || 'WH-UNKNOWN'
        if (!whMap.has(key)) whMap.set(key, [])
        whMap.get(key)!.push(r)
      }

      for (const [warehouseId, whRecs] of whMap) {
        stepOrder++
        const inputValues = JSON.stringify({
          routeId,
          warehouseId,
          recordCount: whRecs.length,
          temps: whRecs.map((r) => r.temperature),
          mileages: whRecs.map((r) => r.mileage),
          capacities: whRecs.map((r) => r.vehicleCapacity),
        })

        const avgTemp = whRecs.reduce((s, r) => s + r.temperature, 0) / whRecs.length
        const avgMileage = whRecs.reduce((s, r) => s + r.mileage, 0) / whRecs.length
        const totalLoad = whRecs.reduce((s, r) => s + r.vehicleCapacity, 0)

        const tempInRange = avgTemp >= param.tempZoneMin && avgTemp <= param.tempZoneMax
        const mileageOk = avgMileage <= param.maxMileage
        const loadOk = totalLoad <= param.vehicleCapacity

        const efficiency = tempInRange && mileageOk && loadOk
          ? ((1 - avgMileage / param.maxMileage) * 0.4 + (totalLoad / param.vehicleCapacity) * 0.6)
          : Math.max(0, (1 - avgMileage / param.maxMileage) * 0.3 + (totalLoad / param.vehicleCapacity) * 0.3)

        const isAnomaly = !tempInRange || !mileageOk
        let anomalyReason = ''
        if (!tempInRange) anomalyReason += `温度${avgTemp.toFixed(1)}°C超出[${param.tempZoneMin},${param.tempZoneMax}] `
        if (!mileageOk) anomalyReason += `里程${avgMileage.toFixed(1)}km超过上限${param.maxMileage}km`

        const vehicleId = `VH-${routeId}-${warehouseId}`
        const outputValues = JSON.stringify({
          vehicleId,
          assignedTemp: avgTemp,
          assignedMileage: avgMileage,
          assignedLoad: totalLoad,
          efficiency: efficiency.toFixed(4),
          tempInRange,
          mileageOk,
          loadOk,
        })

        const resultEntry: Omit<AllocationResult, 'id'> = {
          paramVersionId,
          calculatedAt: new Date().toISOString(),
          routeId,
          warehouseId,
          vehicleId,
          assignedTemp: parseFloat(avgTemp.toFixed(2)),
          assignedMileage: parseFloat(avgMileage.toFixed(2)),
          assignedLoad: parseFloat(totalLoad.toFixed(2)),
          efficiency: parseFloat(efficiency.toFixed(4)),
        }
        newResults.push(resultEntry)

        newSteps.push({
          resultId: 0,
          stepOrder,
          description: `路线${routeId} → 仓库${warehouseId} 分配计算`,
          inputValues,
          outputValues,
          paramVersionId: param.versionLabel,
          isAnomaly,
          anomalyReason,
        })
      }
    }

    const resultIds = await db.allocationResults.bulkAdd(newResults as AllocationResult[])
    for (let i = 0; i < newSteps.length; i++) {
      const resultId = Array.isArray(resultIds) ? resultIds[i] : (resultIds as number) + i
      newSteps[i].resultId = resultId
    }
    await db.calcSteps.bulkAdd(newSteps as CalcStep[])

    await addAuditLog('calculation', '完成路线分配', `生成 ${newResults.length} 条分配结果`, String(paramVersionId))

    await get().loadData()
  },

  toggleAnomaly: async (recordId, included) => {
    await db.unifiedRecords.update(recordId, { isAnomaly: !included })
    await addAuditLog('data', included ? '取消异常标记' : '标记为异常', `记录ID: ${recordId}`, String(recordId))
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId ? { ...r, isAnomaly: !included } : r
      ),
    }))
  },

  detectConflicts: async () => {
    const allRecords = await db.unifiedRecords.toArray()
    const dataSources = await db.dataSources.toArray()
    const dsMap = new Map(dataSources.map((d) => [d.id!, d]))

    const groups = new Map<string, UnifiedRecord[]>()
    for (const r of allRecords) {
      const key = `${r.routeId}||${r.warehouseId}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }

    const existingConflicts = await db.conflicts.toArray()
    const existingKeys = new Set(existingConflicts.map((c) => `${c.historicalRecordId}-${c.importedRecordId}-${c.fieldName}`))

    const newConflicts: Omit<Conflict, 'id'>[] = []

    for (const [, recs] of groups) {
      if (recs.length < 2) continue
      for (let i = 0; i < recs.length; i++) {
        for (let j = i + 1; j < recs.length; j++) {
          const a = recs[i]
          const b = recs[j]
          if (a.dataSourceId === b.dataSourceId) continue

          const aDS = dsMap.get(a.dataSourceId)
          const bDS = dsMap.get(b.dataSourceId)
          const aIsHist = aDS?.type === 'lecture' || aDS?.type === 'business_table'
          const bIsHist = bDS?.type === 'lecture' || bDS?.type === 'business_table'
          const histRec = aIsHist ? a : bIsHist ? b : a
          const impRec = aIsHist ? b : bIsHist ? a : b

          if (Math.abs(a.temperature - b.temperature) > 2) {
            const key = `${histRec.id}-${impRec.id}-temperature`
            if (!existingKeys.has(key)) {
              newConflicts.push({
                historicalRecordId: histRec.id!,
                importedRecordId: impRec.id!,
                conflictType: 'value_mismatch',
                historicalValue: `${histRec.temperature}℃`,
                importedValue: `${impRec.temperature}℃`,
                fieldName: 'temperature',
                status: 'pending',
              })
            }
          }
          if (a.originalUnit !== b.originalUnit && a.originalUnit && b.originalUnit) {
            const key = `${histRec.id}-${impRec.id}-unit-temperature`
            if (!existingKeys.has(key)) {
              newConflicts.push({
                historicalRecordId: histRec.id!,
                importedRecordId: impRec.id!,
                conflictType: 'unit_mismatch',
                historicalValue: a.originalUnit.split(',').find((u) => u.includes('°') || u.includes('C') || u.includes('F')) || a.originalUnit,
                importedValue: b.originalUnit.split(',').find((u) => u.includes('°') || u.includes('C') || u.includes('F')) || b.originalUnit,
                fieldName: 'temperature',
                status: 'pending',
              })
            }
          }
          if (Math.abs(a.mileage - b.mileage) > 5) {
            const key = `${histRec.id}-${impRec.id}-mileage`
            if (!existingKeys.has(key)) {
              newConflicts.push({
                historicalRecordId: histRec.id!,
                importedRecordId: impRec.id!,
                conflictType: 'value_mismatch',
                historicalValue: `${histRec.mileage}km`,
                importedValue: `${impRec.mileage}km`,
                fieldName: 'mileage',
                status: 'pending',
              })
            }
          }
          if (Math.abs(a.vehicleCapacity - b.vehicleCapacity) > 0.5) {
            const key = `${histRec.id}-${impRec.id}-capacity`
            if (!existingKeys.has(key)) {
              newConflicts.push({
                historicalRecordId: histRec.id!,
                importedRecordId: impRec.id!,
                conflictType: 'value_mismatch',
                historicalValue: `${histRec.vehicleCapacity}吨`,
                importedValue: `${impRec.vehicleCapacity}吨`,
                fieldName: 'vehicleCapacity',
                status: 'pending',
              })
            }
          }
        }
      }
    }

    if (newConflicts.length > 0) {
      await db.conflicts.bulkAdd(newConflicts as Conflict[])
      await addAuditLog('conflict', '检测到冲突', `共 ${newConflicts.length} 条冲突`, '')
    } else {
      await addAuditLog('conflict', '检测冲突完成', '未发现新冲突', '')
    }

    await get().loadData()
  },

  resolveConflict: async (conflictId, resolution) => {
    const conflict = await db.conflicts.get(conflictId)
    if (!conflict) return

    await db.conflictResolutions.add(resolution as ConflictResolution)
    await db.conflicts.update(conflictId, { status: 'resolved' })

    let finalValue: string | number | null = null
    let targetRecordId: number | null = null

    if (resolution.chosenSide === 'historical') {
      finalValue = conflict.historicalValue
      targetRecordId = conflict.importedRecordId
    } else if (resolution.chosenSide === 'imported') {
      finalValue = conflict.importedValue
      targetRecordId = conflict.historicalRecordId
    } else if (resolution.chosenSide === 'manual' && resolution.manualValue) {
      finalValue = resolution.manualValue
      targetRecordId = conflict.historicalRecordId
    }

    if (targetRecordId !== null && finalValue !== null && conflict.fieldName && conflict.conflictType === 'value_mismatch') {
      const fieldName = conflict.fieldName as keyof UnifiedRecord
      const numericFields = ['temperature', 'mileage', 'vehicleCapacity'] as const
      if (numericFields.includes(fieldName as any)) {
        const cleanVal = String(finalValue).replace(/[^0-9.\-]/g, '')
        const numericVal = parseFloat(cleanVal)
        if (!isNaN(numericVal)) {
          await db.unifiedRecords.update(conflict.historicalRecordId, { [fieldName]: numericVal } as any)
          await db.unifiedRecords.update(conflict.importedRecordId, { [fieldName]: numericVal } as any)
        }
      }
    }

    await addAuditLog('conflict', '裁决冲突', `冲突ID: ${conflictId}, 选择: ${resolution.chosenSide}, 理由: ${resolution.reason}, 回写字段: ${conflict.fieldName}`, String(conflictId))
    await get().loadData()
  },

  setSelectedResultId: (id) => set({ selectedResultId: id }),
  setSelectedDetailRow: (id) => set({ selectedDetailRow: id }),

  exportAuditLog: () => get().auditLog,

  addAuditLog: async (category, action, detail, relatedId = '') => {
    await addAuditLog(category, action, detail, relatedId)
    await get().loadData()
  },

  clearAllData: async () => {
    await db.dataSources.clear()
    await db.unifiedRecords.clear()
    await db.fieldMappings.clear()
    await db.unitConversions.clear()
    await db.allocationParams.clear()
    await db.allocationResults.clear()
    await db.calcSteps.clear()
    await db.conflicts.clear()
    await db.conflictResolutions.clear()
    await db.auditLog.clear()
    await get().loadData()
  },
}))

if (typeof window !== 'undefined') {
  ;(window as any).__coldChainStore = useStore
}
