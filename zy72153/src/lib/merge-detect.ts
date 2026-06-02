import type { PointLocation, ApprovalRecord, MergeGroup, ConflictItem, MergeType, ConflictType } from '@/types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

export function createPointLocation(data: Partial<PointLocation>): PointLocation {
  const now = new Date().toISOString()
  return {
    id: data.id || generateId(),
    name: data.name || '',
    district: data.district || '',
    longitude: data.longitude ?? null,
    latitude: data.latitude ?? null,
    complaintId: data.complaintId || '',
    complaintTime: data.complaintTime || '',
    approvalRef: data.approvalRef || '',
    designCapacity: data.designCapacity ?? null,
    actualDemand: data.actualDemand ?? null,
    constructionPeriod: data.constructionPeriod || '',
    maintenancePeriod: data.maintenancePeriod || '',
    status: data.status || 'pending',
    sourceTrace: data.sourceTrace || '',
    mergeReason: data.mergeReason || '',
    conflictNote: data.conflictNote || '',
    mergedFrom: data.mergedFrom || [],
    createdAt: data.createdAt || now,
    updatedAt: now,
  }
}

export function createApprovalRecord(data: Partial<ApprovalRecord>): ApprovalRecord {
  return {
    id: data.id || generateId(),
    approvalRef: data.approvalRef || '',
    locationName: data.locationName || '',
    district: data.district || '',
    content: data.content || '',
    approvalStatus: data.approvalStatus || '',
    approvedAt: data.approvedAt || '',
    designCapacity: data.designCapacity ?? null,
    constructionPeriod: data.constructionPeriod || '',
    maintenancePeriod: data.maintenancePeriod || '',
    sourceFile: data.sourceFile || '',
  }
}

export function createMergeGroup(data: { mergeType: MergeType; reason: string; mergedIds: string[] }): MergeGroup {
  return {
    id: generateId(),
    mergeType: data.mergeType,
    reason: data.reason,
    mergedIds: data.mergedIds,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

export function createConflictItem(data: {
  pointId: string
  approvalId: string
  conflictType: ConflictType
  pointEvidence: string
  approvalEvidence: string
  suggestion: string
}): ConflictItem {
  return {
    id: generateId(),
    pointId: data.pointId,
    approvalId: data.approvalId,
    conflictType: data.conflictType,
    pointEvidence: data.pointEvidence,
    approvalEvidence: data.approvalEvidence,
    suggestion: data.suggestion,
    resolution: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function detectSameNameGroups(points: PointLocation[]): MergeGroup[] {
  const groups: Map<string, PointLocation[]> = new Map()
  for (const p of points) {
    if (p.status === 'merged') continue
    const key = `${p.name}||${p.district}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const result: MergeGroup[] = []
  for (const [, pts] of groups) {
    if (pts.length > 1) {
      result.push(createMergeGroup({
        mergeType: 'same_name',
        reason: `路口"${pts[0].name}"(${pts[0].district})存在${pts.length}条同名记录`,
        mergedIds: pts.map(p => p.id),
      }))
    }
  }
  return result
}

export function detectDuplicateComplaints(points: PointLocation[]): MergeGroup[] {
  const byComplaintId: Map<string, PointLocation[]> = new Map()
  const noId: PointLocation[] = []
  for (const p of points) {
    if (p.status === 'merged') continue
    if (p.complaintId) {
      if (!byComplaintId.has(p.complaintId)) byComplaintId.set(p.complaintId, [])
      byComplaintId.get(p.complaintId)!.push(p)
    } else {
      noId.push(p)
    }
  }
  const result: MergeGroup[] = []
  for (const [, pts] of byComplaintId) {
    if (pts.length > 1) {
      result.push(createMergeGroup({
        mergeType: 'duplicate_complaint',
        reason: `投诉编号${pts[0].complaintId}存在${pts.length}条重复记录`,
        mergedIds: pts.map(p => p.id),
      }))
    }
  }
  const timeWindowMs = 7 * 24 * 60 * 60 * 1000
  for (let i = 0; i < noId.length; i++) {
    for (let j = i + 1; j < noId.length; j++) {
      const a = noId[i]
      const b = noId[j]
      if (a.name === b.name && a.district === b.district && a.complaintTime && b.complaintTime) {
        const diff = Math.abs(new Date(a.complaintTime).getTime() - new Date(b.complaintTime).getTime())
        if (diff <= timeWindowMs) {
          result.push(createMergeGroup({
            mergeType: 'duplicate_complaint',
            reason: `路口"${a.name}"(${a.district})7天内有2条投诉，疑似重复`,
            mergedIds: [a.id, b.id],
          }))
        }
      }
    }
  }
  return result
}

export function detectCoordinateDrift(points: PointLocation[], thresholdMeters = 50): MergeGroup[] {
  const groups: Map<string, PointLocation[]> = new Map()
  for (const p of points) {
    if (p.status === 'merged') continue
    if (p.longitude == null || p.latitude == null) continue
    const key = `${p.name}||${p.district}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const result: MergeGroup[] = []
  for (const [, pts] of groups) {
    if (pts.length < 2) continue
    const visited = new Set<string>()
    for (let i = 0; i < pts.length; i++) {
      if (visited.has(pts[i].id)) continue
      const cluster = [pts[i]]
      for (let j = i + 1; j < pts.length; j++) {
        if (visited.has(pts[j].id)) continue
        const dist = haversineDistance(
          pts[i].latitude!, pts[i].longitude!,
          pts[j].latitude!, pts[j].longitude!,
        )
        if (dist < thresholdMeters) {
          cluster.push(pts[j])
          visited.add(pts[j].id)
        }
      }
      if (cluster.length > 1) {
        visited.add(pts[i].id)
        const maxDist = Math.max(
          ...cluster.flatMap((a, idx) =>
            cluster.slice(idx + 1).map(b =>
              haversineDistance(a.latitude!, a.longitude!, b.latitude!, b.longitude!)
            )
          )
        )
        result.push(createMergeGroup({
          mergeType: 'coordinate_drift',
          reason: `路口"${cluster[0].name}"(${cluster[0].district})坐标偏移${maxDist.toFixed(1)}米，建议合并`,
          mergedIds: cluster.map(p => p.id),
        }))
      }
    }
  }
  return result
}

export function detectConflicts(
  points: PointLocation[],
  approvals: ApprovalRecord[],
): ConflictItem[] {
  const conflicts: ConflictItem[] = []
  for (const point of points) {
    const matched = approvals.filter(
      a => a.approvalRef === point.approvalRef ||
        (a.locationName === point.name && a.district === point.district)
    )
    if (!matched.length) continue
    for (const approval of matched) {
      if (point.designCapacity != null && approval.designCapacity != null && point.designCapacity !== approval.designCapacity) {
        conflicts.push(createConflictItem({
          pointId: point.id,
          approvalId: approval.id,
          conflictType: 'data_mismatch',
          pointEvidence: `导入数据：设计容量${point.designCapacity}m³`,
          approvalEvidence: `审批台账：设计容量${approval.designCapacity}m³`,
          suggestion: `设计容量不一致，请核实以审批台账为准(${approval.designCapacity}m³)还是以导入数据为准(${point.designCapacity}m³)`,
        }))
      }
      if (point.designCapacity != null && point.actualDemand != null && point.actualDemand > point.designCapacity) {
        const overflow = point.actualDemand - point.designCapacity
        conflicts.push(createConflictItem({
          pointId: point.id,
          approvalId: approval.id,
          conflictType: 'capacity_overflow',
          pointEvidence: `实际需求${point.actualDemand}m³，设计容量${point.designCapacity}m³`,
          approvalEvidence: `审批台账设计容量${approval.designCapacity ?? '未填写'}m³`,
          suggestion: `超出设计容量${overflow.toFixed(1)}m³，建议调整汇水面积或增设调蓄设施`,
        }))
      }
      if (point.constructionPeriod && point.maintenancePeriod && approval.constructionPeriod && approval.maintenancePeriod) {
        const cOverlaps = periodsOverlap(point.constructionPeriod, approval.constructionPeriod)
        const mOverlaps = periodsOverlap(point.maintenancePeriod, approval.maintenancePeriod)
        if (cOverlaps || mOverlaps) {
          conflicts.push(createConflictItem({
            pointId: point.id,
            approvalId: approval.id,
            conflictType: 'time_conflict',
            pointEvidence: `导入数据施工期:${point.constructionPeriod}，养护期:${point.maintenancePeriod}`,
            approvalEvidence: `审批台账施工期:${approval.constructionPeriod}，养护期:${approval.maintenancePeriod}`,
            suggestion: `${cOverlaps ? '施工期' : '养护期'}与审批台账存在重叠，建议错开时段以避免冲突`,
          }))
        }
      }
    }
  }
  for (const point of points) {
    if (point.status === 'merged') continue
    const hasNull = point.longitude == null || point.latitude == null || !point.name || !point.district
    if (hasNull) {
      const nullFields: string[] = []
      if (point.longitude == null) nullFields.push('经度')
      if (point.latitude == null) nullFields.push('纬度')
      if (!point.name) nullFields.push('路口名称')
      if (!point.district) nullFields.push('行政区划')
      const existing = conflicts.find(c => c.pointId === point.id && c.conflictType === 'null_value')
      if (!existing) {
        conflicts.push(createConflictItem({
          pointId: point.id,
          approvalId: '',
          conflictType: 'null_value',
          pointEvidence: `缺失字段：${nullFields.join('、')}`,
          approvalEvidence: '',
          suggestion: `请补充${nullFields.join('、')}信息，否则无法进行空间分析`,
        }))
      }
    }
  }
  return conflicts
}

function periodsOverlap(periodA: string, periodB: string): boolean {
  const parseRange = (s: string) => {
    const parts = s.split('~').map(p => p.trim())
    if (parts.length !== 2) return null
    return { start: new Date(parts[0]), end: new Date(parts[1]) }
  }
  const a = parseRange(periodA)
  const b = parseRange(periodB)
  if (!a || !b) return false
  return a.start <= b.end && b.start <= a.end
}

export function generateConflictNote(conflict: ConflictItem): string {
  switch (conflict.conflictType) {
    case 'capacity_overflow':
      return `容量超限：${conflict.pointEvidence}。${conflict.suggestion}`
    case 'time_conflict':
      return `时段冲突：${conflict.pointEvidence}与${conflict.approvalEvidence}重叠。${conflict.suggestion}`
    case 'data_mismatch':
      return `数据不一致：${conflict.pointEvidence}，${conflict.approvalEvidence}。${conflict.suggestion}`
    case 'null_value':
      return `数据缺失：${conflict.pointEvidence}。${conflict.suggestion}`
    case 'boundary':
      return `边界记录：${conflict.pointEvidence}。${conflict.suggestion}`
    default:
      return conflict.suggestion
  }
}
