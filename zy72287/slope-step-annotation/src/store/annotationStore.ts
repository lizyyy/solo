import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type {
  SlopeStepAnnotation,
  RangefinderRecord,
  ObstacleRemark,
  ConflictEvidence,
  SelfCheckIssue,
  FieldInstruction,
  WorkflowStep,
  CoordValue,
  ParamVersion,
  ConflictResolution,
} from '../types'

interface AnnotationStore {
  annotation: SlopeStepAnnotation

  importRangefinderRecords: (lines: string[]) => string
  addObstacleRemark: (recordId: string, content: string, originalLines: string[], source: ObstacleRemark['source']) => void
  advanceWorkflow: (step: WorkflowStep) => void
  resolveConflict: (conflictId: string, resolution: ConflictResolution, reason: string, resolvedBy: string) => void
  updateFieldInstruction: (recordId: string, content: string, updatedBy: string) => void
  runSelfCheck: () => SelfCheckIssue[]
  resolveSelfCheckIssue: (issueId: string) => void
  getExportData: () => object
  getApiReturn: () => object
  loadFromStorage: () => void
  saveToStorage: () => void
  resetAnnotation: () => void
}

function createEmptyAnnotation(): SlopeStepAnnotation {
  return {
    id: uuid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStep: 'rangefinder_imported',
    rangefinderRecords: [],
    obstacleRemarks: [],
    conflicts: [],
    selfCheckIssues: [],
    fieldInstructions: [],
    paramVersions: [],
  }
}

const COORD_METRIC_PATTERN = /[xXyY]\s*[:=]\s*[\d.]+/
const COORD_LNG_LAT_PATTERN = /(?:经度|纬度|lng|lat|longitude|latitude)\s*[:/=：]\s*[\d.]+/i
const LNG_LAT_COMPOUND_PATTERN = /(经度\s*\/\s*纬度|纬度\s*\/\s*经度)\s*[:=：]\s*([\d.]+)\s*\/\s*([\d.]+)/i

function parseCoord(raw: string): CoordValue {
  const hasMetric = COORD_METRIC_PATTERN.test(raw)
  const hasLngLat =
    COORD_LNG_LAT_PATTERN.test(raw) || LNG_LAT_COMPOUND_PATTERN.test(raw)

  const isMixed = hasMetric && hasLngLat
  let mixedDetail: string | undefined
  if (isMixed) {
    mixedDetail = `原始值"${raw}"同时包含经纬度和米制坐标`
  }

  const coord: CoordValue = {
    system: hasMetric && !hasLngLat ? 'local_metric' : 'wgs84',
    raw,
    isMixed,
    mixedDetail,
  }

  const compoundMatch = raw.match(LNG_LAT_COMPOUND_PATTERN)
  if (compoundMatch) {
    const firstIsLng = /^经度/.test(compoundMatch[1])
    const firstVal = parseFloat(compoundMatch[2])
    const secondVal = parseFloat(compoundMatch[3])
    if (firstIsLng) {
      coord.lng = firstVal
      coord.lat = secondVal
    } else {
      coord.lat = firstVal
      coord.lng = secondVal
    }
  } else {
    const lngMatch = raw.match(/(?:经度|lng|longitude)\s*[:=：]\s*([\d.]+)/i)
    const latMatch = raw.match(/(?:纬度|lat|latitude)\s*[:=：]\s*([\d.]+)/i)
    if (lngMatch) coord.lng = parseFloat(lngMatch[1])
    if (latMatch) coord.lat = parseFloat(latMatch[1])
  }

  const xMatch = raw.match(/[xX]\s*[:=]\s*([\d.]+)/)
  const yMatch = raw.match(/[yY]\s*[:=]\s*([\d.]+)/)
  if (xMatch) coord.x = parseFloat(xMatch[1])
  if (yMatch) coord.y = parseFloat(yMatch[1])

  return coord
}

function parseRangefinderLine(line: string, batchId: string): RangefinderRecord {
  const parts = line.split(/[,\t;，；]/)
  const pointId = parts[0]?.trim() || '未知点'
  const coordRaw = parts.slice(1).join(',')
  const coord = parseCoord(coordRaw || line)

  let elevation: number | null = null
  let slopeAngle: number | null = null
  let slopeDirection: string | null = null
  let distance: number | null = null

  for (const p of parts) {
    const trimmed = p.trim()
    const elevMatch = trimmed.match(/高程\s*[:=：]\s*([\d.]+)/)
    if (elevMatch) elevation = parseFloat(elevMatch[1])
    const slopeMatch = trimmed.match(/坡度\s*[:=：]\s*([\d.]+)/)
    if (slopeMatch) slopeAngle = parseFloat(slopeMatch[1])
    const dirMatch = trimmed.match(/坡向\s*[:=：]\s*(\S+)/)
    if (dirMatch) slopeDirection = dirMatch[1]
    const distMatch = trimmed.match(/距离\s*[:=：]\s*([\d.]+)/)
    if (distMatch) distance = parseFloat(distMatch[1])
  }

  return {
    id: uuid(),
    importBatchId: batchId,
    importTime: new Date().toISOString(),
    pointId,
    coord,
    elevation,
    slopeAngle,
    slopeDirection,
    distance,
    rawLine: line,
  }
}

function detectConflicts(
  records: RangefinderRecord[],
  remarks: ObstacleRemark[]
): ConflictEvidence[] {
  const conflicts: ConflictEvidence[] = []

  for (const record of records) {
    const relatedRemarks = remarks.filter((r) => r.recordId === record.id)
    for (const remark of relatedRemarks) {
      const lines = remark.originalLines
      for (const line of lines) {
        const slopeMatch = line.match(/坡度\s*[:=：]\s*([\d.]+)/)
        if (slopeMatch && record.slopeAngle !== null) {
          const remarkSlope = parseFloat(slopeMatch[1])
          if (Math.abs(remarkSlope - record.slopeAngle) > 1) {
            conflicts.push({
              id: uuid(),
              recordId: record.id,
              rangefinderField: 'slopeAngle',
              rangefinderValue: String(record.slopeAngle),
              remarkField: '坡度',
              remarkValue: slopeMatch[1],
              remarkId: remark.id,
              resolution: 'pending',
            })
          }
        }

        const elevMatch = line.match(/高程\s*[:=：]\s*([\d.]+)/)
        if (elevMatch && record.elevation !== null) {
          const remarkElev = parseFloat(elevMatch[1])
          if (Math.abs(remarkElev - record.elevation) > 0.5) {
            conflicts.push({
              id: uuid(),
              recordId: record.id,
              rangefinderField: 'elevation',
              rangefinderValue: String(record.elevation),
              remarkField: '高程',
              remarkValue: elevMatch[1],
              remarkId: remark.id,
              resolution: 'pending',
            })
          }
        }

        const distMatch = line.match(/距离\s*[:=：]\s*([\d.]+)/)
        if (distMatch && record.distance !== null) {
          const remarkDist = parseFloat(distMatch[1])
          if (Math.abs(remarkDist - record.distance) > 1) {
            conflicts.push({
              id: uuid(),
              recordId: record.id,
              rangefinderField: 'distance',
              rangefinderValue: String(record.distance),
              remarkField: '距离',
              remarkValue: distMatch[1],
              remarkId: remark.id,
              resolution: 'pending',
            })
          }
        }
      }
    }
  }

  return conflicts
}

function runSelfCheckLogic(annotation: SlopeStepAnnotation): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = []
  const now = new Date().toISOString()
  const { rangefinderRecords, obstacleRemarks, fieldInstructions } = annotation

  const seenKeys = new Map<string, string>()
  for (const r of rangefinderRecords) {
    const key = `${r.pointId}|${r.coord.raw}|${r.elevation}|${r.slopeAngle}`
    if (seenKeys.has(key)) {
      issues.push({
        id: uuid(),
        type: 'duplicate_import',
        severity: 'warning',
        recordIds: [r.id, seenKeys.get(key)!],
        message: `重复导入：点号${r.pointId}的记录重复`,
        detail: `原始行："${r.rawLine}"与已有记录重复`,
        detectedAt: now,
        resolved: false,
      })
    } else {
      seenKeys.set(key, r.id)
    }
  }

  for (const r of rangefinderRecords) {
    if (r.coord.isMixed) {
      issues.push({
        id: uuid(),
        type: 'mixed_coord',
        severity: 'error',
        recordIds: [r.id],
        message: `坐标混用：点号${r.pointId}的坐标同时包含经纬度和米制值`,
        detail: r.coord.mixedDetail || `原始值："${r.coord.raw}"`,
        detectedAt: now,
        resolved: false,
      })
    }
  }

  const remarkRecordIds = new Set(obstacleRemarks.map((r) => r.recordId))
  for (const r of rangefinderRecords) {
    if (remarkRecordIds.has(r.id)) {
      const remark = obstacleRemarks.find((rm) => rm.recordId === r.id)!
      if (remark.addedAt > r.importTime) {
        const instr = fieldInstructions.find((fi) => fi.recordId === r.id)
        if (!instr || instr.updatedAt < remark.addedAt) {
          issues.push({
            id: uuid(),
            type: 'recalc_after_supplement',
            severity: 'warning',
            recordIds: [r.id],
            message: `补录后未重算：点号${r.pointId}在补录障碍物备注后，现场说明尚未更新`,
            detail: `障碍物备注于${remark.addedAt}添加，但现场说明未在此之后更新`,
            detectedAt: now,
            resolved: false,
          })
        }
      }
    }
  }

  for (const r of rangefinderRecords) {
    const instr = fieldInstructions.find((fi) => fi.recordId === r.id)
    if (instr) {
      const coordInInstruction = instr.coordDisplay
      const coordFromRecord = formatCoordForDisplay(r.coord)
      if (coordInInstruction !== coordFromRecord) {
        issues.push({
          id: uuid(),
          type: 'export_consistency',
          severity: 'error',
          recordIds: [r.id],
          message: `导出不一致：点号${r.pointId}的坐标在记录与现场说明中不一致`,
          detail: `记录中："${coordFromRecord}"，现场说明中："${coordInInstruction}"`,
          detectedAt: now,
          resolved: false,
        })
      }

      if (r.coord.isMixed && !instr.coordMixedFlag) {
        issues.push({
          id: uuid(),
          type: 'export_consistency',
          severity: 'error',
          recordIds: [r.id],
          message: `导出不一致：点号${r.pointId}的坐标混用标记在记录中存在但在现场说明中消失`,
          detail: `记录标记为坐标混用，但现场说明未标记`,
          detectedAt: now,
          resolved: false,
        })
      }
    }
  }

  return issues
}

function formatCoordForDisplay(coord: CoordValue): string {
  if (coord.isMixed) {
    return `[混用]${coord.raw}`
  }
  if (coord.system === 'local_metric') {
    return `X=${coord.x ?? '?'}, Y=${coord.y ?? '?'}`
  }
  return `经度=${coord.lng ?? '?'}, 纬度=${coord.lat ?? '?'}`
}

function buildFieldInstruction(
  record: RangefinderRecord,
  remarks: ObstacleRemark[],
  existingInstr: FieldInstruction | undefined,
  paramVersions: ParamVersion[],
  updatedBy: string
): FieldInstruction {
  const relatedRemarks = remarks.filter((r) => r.recordId === record.id)
  const remarkLines = relatedRemarks.flatMap((r) => r.originalLines)

  const parts: string[] = [`【点号】${record.pointId}`]
  parts.push(`【坐标】${formatCoordForDisplay(record.coord)}`)
  if (record.coord.isMixed) {
    parts.push(`⚠ 坐标混用：${record.coord.mixedDetail || '经纬度与米制坐标混合，留待巡检组复核'}`)
  }
  if (record.elevation !== null) parts.push(`【高程】${record.elevation}m`)
  if (record.slopeAngle !== null) parts.push(`【坡度】${record.slopeAngle}°`)
  if (record.slopeDirection !== null) parts.push(`【坡向】${record.slopeDirection}`)
  if (record.distance !== null) parts.push(`【距离】${record.distance}m`)

  if (remarkLines.length > 0) {
    parts.push('【障碍物备注】')
    parts.push(...remarkLines.map((l) => `  ${l}`))
  }

  if (paramVersions.length > 0) {
    parts.push('【参数版本】')
    for (const pv of paramVersions) {
      parts.push(`  模型:${pv.model} v${pv.version} 取舍:${pv.tradeOffReason}`)
    }
  }

  return {
    id: existingInstr?.id || uuid(),
    recordId: record.id,
    content: parts.join('\n'),
    coordDisplay: formatCoordForDisplay(record.coord),
    coordMixedFlag: record.coord.isMixed,
    coordMixedSource: record.coord.isMixed ? record.coord.raw : undefined,
    coordMixedNextAction: record.coord.isMixed
      ? '巡检组复核：确认坐标系统归属后更新'
      : undefined,
    updatedAt: new Date().toISOString(),
    updatedBy,
    version: (existingInstr?.version ?? 0) + 1,
    paramVersions: [...paramVersions],
  }
}

const STORAGE_KEY = 'slope_step_annotation'

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotation: createEmptyAnnotation(),

  importRangefinderRecords: (lines: string[]) => {
    const batchId = uuid()
    const newRecords = lines
      .filter((l) => l.trim())
      .map((l) => parseRangefinderLine(l, batchId))

    set((state) => {
      const updated: SlopeStepAnnotation = {
        ...state.annotation,
        rangefinderRecords: [...state.annotation.rangefinderRecords, ...newRecords],
        currentStep: 'rangefinder_imported',
        updatedAt: new Date().toISOString(),
      }
      return { annotation: updated }
    })

    const state = get()
    const allConflicts = detectConflicts(
      state.annotation.rangefinderRecords,
      state.annotation.obstacleRemarks
    )
    const existingConflictIds = new Set(state.annotation.conflicts.map((c) => c.id))
    const trulyNew = allConflicts.filter((c) => !existingConflictIds.has(c.id))

    if (trulyNew.length > 0) {
      set((state) => ({
        annotation: {
          ...state.annotation,
          conflicts: [...state.annotation.conflicts, ...trulyNew],
          updatedAt: new Date().toISOString(),
        },
      }))
    }

    get().saveToStorage()
    return batchId
  },

  addObstacleRemark: (recordId, content, originalLines, source) => {
    const remark: ObstacleRemark = {
      id: uuid(),
      recordId,
      content,
      originalLines: [...originalLines],
      addedAt: new Date().toISOString(),
      addedBy: '航测内业小魏',
      source,
    }

    set((state) => {
      const updated: SlopeStepAnnotation = {
        ...state.annotation,
        obstacleRemarks: [...state.annotation.obstacleRemarks, remark],
        updatedAt: new Date().toISOString(),
      }
      return { annotation: updated }
    })

    const state = get()
    const allConflicts = detectConflicts(
      state.annotation.rangefinderRecords,
      state.annotation.obstacleRemarks
    )
    const existingIds = new Set(state.annotation.conflicts.map((c) => c.id))
    const newConflicts = allConflicts.filter((c) => !existingIds.has(c.id))
    if (newConflicts.length > 0) {
      set((state) => ({
        annotation: {
          ...state.annotation,
          conflicts: [...state.annotation.conflicts, ...newConflicts],
          updatedAt: new Date().toISOString(),
        },
      }))
    }

    get().saveToStorage()
  },

  advanceWorkflow: (step) => {
    set((state) => ({
      annotation: {
        ...state.annotation,
        currentStep: step,
        updatedAt: new Date().toISOString(),
      },
    }))
    get().saveToStorage()
  },

  resolveConflict: (conflictId, resolution, reason, resolvedBy) => {
    set((state) => ({
      annotation: {
        ...state.annotation,
        conflicts: state.annotation.conflicts.map((c) =>
          c.id === conflictId
            ? {
                ...c,
                resolution,
                resolvedBy,
                resolvedAt: new Date().toISOString(),
                resolutionReason: reason,
              }
            : c
        ),
        updatedAt: new Date().toISOString(),
      },
    }))
    get().saveToStorage()
  },

  updateFieldInstruction: (recordId, content, updatedBy) => {
    const state = get()
    const record = state.annotation.rangefinderRecords.find((r) => r.id === recordId)
    if (!record) return

    const existing = state.annotation.fieldInstructions.find((fi) => fi.recordId === recordId)
    const instr = buildFieldInstruction(
      record,
      state.annotation.obstacleRemarks,
      existing,
      state.annotation.paramVersions,
      updatedBy
    )

    instr.content = content || instr.content

    set((state) => {
      const others = state.annotation.fieldInstructions.filter((fi) => fi.recordId !== recordId)
      return {
        annotation: {
          ...state.annotation,
          fieldInstructions: [...others, instr],
          updatedAt: new Date().toISOString(),
        },
      }
    })
    get().saveToStorage()
  },

  runSelfCheck: () => {
    const state = get()
    const issues = runSelfCheckLogic(state.annotation)
    set((state) => ({
      annotation: {
        ...state.annotation,
        selfCheckIssues: issues,
        updatedAt: new Date().toISOString(),
      },
    }))
    get().saveToStorage()
    return issues
  },

  resolveSelfCheckIssue: (issueId) => {
    set((state) => ({
      annotation: {
        ...state.annotation,
        selfCheckIssues: state.annotation.selfCheckIssues.map((i) =>
          i.id === issueId ? { ...i, resolved: true, resolvedAt: new Date().toISOString() } : i
        ),
        updatedAt: new Date().toISOString(),
      },
    }))
    get().saveToStorage()
  },

  getExportData: () => {
    const { annotation } = get()
    return {
      id: annotation.id,
      exportTime: new Date().toISOString(),
      currentStep: annotation.currentStep,
      records: annotation.rangefinderRecords.map((r) => ({
        pointId: r.pointId,
        coord: formatCoordForDisplay(r.coord),
        coordMixed: r.coord.isMixed,
        coordMixedDetail: r.coord.mixedDetail,
        elevation: r.elevation,
        slopeAngle: r.slopeAngle,
        slopeDirection: r.slopeDirection,
        distance: r.distance,
      })),
      remarks: annotation.obstacleRemarks.map((rm) => ({
        recordPointId: annotation.rangefinderRecords.find((r) => r.id === rm.recordId)?.pointId,
        content: rm.content,
        originalLines: rm.originalLines,
        source: rm.source,
        addedAt: rm.addedAt,
      })),
      conflicts: annotation.conflicts.map((c) => ({
        recordPointId: annotation.rangefinderRecords.find((r) => r.id === c.recordId)?.pointId,
        rangefinderField: c.rangefinderField,
        rangefinderValue: c.rangefinderValue,
        remarkValue: c.remarkValue,
        resolution: c.resolution,
        resolutionReason: c.resolutionReason,
      })),
      fieldInstructions: annotation.fieldInstructions.map((fi) => ({
        recordPointId: annotation.rangefinderRecords.find((r) => r.id === fi.recordId)?.pointId,
        content: fi.content,
        coordDisplay: fi.coordDisplay,
        coordMixedFlag: fi.coordMixedFlag,
        coordMixedSource: fi.coordMixedSource,
        coordMixedNextAction: fi.coordMixedNextAction,
        version: fi.version,
        paramVersions: fi.paramVersions,
      })),
      selfCheckIssues: annotation.selfCheckIssues.map((i) => ({
        type: i.type,
        severity: i.severity,
        message: i.message,
        detail: i.detail,
        resolved: i.resolved,
      })),
    }
  },

  getApiReturn: () => {
    const { annotation } = get()
    return {
      id: annotation.id,
      currentStep: annotation.currentStep,
      updatedAt: annotation.updatedAt,
      records: annotation.rangefinderRecords.map((r) => ({
        id: r.id,
        pointId: r.pointId,
        coord: {
          system: r.coord.system,
          lng: r.coord.lng,
          lat: r.coord.lat,
          x: r.coord.x,
          y: r.coord.y,
          raw: r.coord.raw,
          isMixed: r.coord.isMixed,
          mixedDetail: r.coord.mixedDetail,
          display: formatCoordForDisplay(r.coord),
        },
        elevation: r.elevation,
        slopeAngle: r.slopeAngle,
        slopeDirection: r.slopeDirection,
        distance: r.distance,
      })),
      remarks: annotation.obstacleRemarks.map((rm) => ({
        id: rm.id,
        recordId: rm.recordId,
        content: rm.content,
        originalLines: rm.originalLines,
        source: rm.source,
        addedAt: rm.addedAt,
        addedBy: rm.addedBy,
      })),
      conflicts: annotation.conflicts.map((c) => ({
        id: c.id,
        recordId: c.recordId,
        rangefinderField: c.rangefinderField,
        rangefinderValue: c.rangefinderValue,
        remarkField: c.remarkField,
        remarkValue: c.remarkValue,
        remarkId: c.remarkId,
        resolution: c.resolution,
        resolvedBy: c.resolvedBy,
        resolvedAt: c.resolvedAt,
        resolutionReason: c.resolutionReason,
      })),
      fieldInstructions: annotation.fieldInstructions.map((fi) => ({
        id: fi.id,
        recordId: fi.recordId,
        content: fi.content,
        coordDisplay: fi.coordDisplay,
        coordMixedFlag: fi.coordMixedFlag,
        coordMixedSource: fi.coordMixedSource,
        coordMixedNextAction: fi.coordMixedNextAction,
        updatedAt: fi.updatedAt,
        updatedBy: fi.updatedBy,
        version: fi.version,
        paramVersions: fi.paramVersions,
      })),
      selfCheckIssues: annotation.selfCheckIssues.map((i) => ({
        id: i.id,
        type: i.type,
        severity: i.severity,
        recordIds: i.recordIds,
        message: i.message,
        detail: i.detail,
        detectedAt: i.detectedAt,
        resolved: i.resolved,
        resolvedAt: i.resolvedAt,
      })),
    }
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as SlopeStepAnnotation
        set({ annotation: parsed })
      }
    } catch {
      /* ignore */
    }
  },

  saveToStorage: () => {
    try {
      const { annotation } = get()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(annotation))
    } catch {
      /* ignore */
    }
  },

  resetAnnotation: () => {
    set({ annotation: createEmptyAnnotation() })
    get().saveToStorage()
  },
}))
