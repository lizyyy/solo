import type { TyphoonEvent, TyphoonPathPoint, Claim, AnomalyRecord, AnomalyType } from '@/types'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function detectPathTimeMisalign(
  pathPoints: TyphoonPathPoint[],
  typhoonEvent: TyphoonEvent
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = []
  const startMs = new Date(typhoonEvent.startDate).getTime()
  const endMs = new Date(typhoonEvent.endDate).getTime()

  for (const point of pathPoints) {
    const pointMs = new Date(point.timestamp).getTime()
    if (pointMs < startMs || pointMs > endMs) {
      anomalies.push({
        id: generateId(),
        cubeSnapshotId: '',
        type: 'path_time_misalign',
        sourceType: 'typhoon_path',
        sourceId: point.id,
        description: `路径点时间 ${point.timestamp} 不在台风事件范围 [${typhoonEvent.startDate}, ${typhoonEvent.endDate}] 内`,
        severity: 'high',
        acknowledged: false,
        detectedAt: new Date().toISOString(),
      })
    }
  }

  return anomalies
}

export function detectExtremeClaimOcclusion(claims: Claim[]): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = []
  const regionTotals = new Map<string, number>()

  for (const claim of claims) {
    const current = regionTotals.get(claim.regionId) || 0
    regionTotals.set(claim.regionId, current + claim.claimAmount)
  }

  for (const claim of claims) {
    const regionTotal = regionTotals.get(claim.regionId) || 0
    if (regionTotal > 0 && claim.claimAmount / regionTotal > 0.5) {
      anomalies.push({
        id: generateId(),
        cubeSnapshotId: '',
        type: 'extreme_claim_occlusion',
        sourceType: 'claim',
        sourceId: claim.id,
        description: `赔付 ${claim.id} 金额 ¥${(claim.claimAmount / 10000).toFixed(1)}万 占该地区总赔付的 ${(claim.claimAmount / regionTotal * 100).toFixed(1)}%，可能遮蔽其他赔付`,
        severity: 'high',
        acknowledged: false,
        detectedAt: new Date().toISOString(),
      })
    }
  }

  return anomalies
}

export function detectRegionAggregateConflict(claims: Claim[]): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = []
  const regionTimeMap = new Map<string, Claim[]>()

  for (const claim of claims) {
    const dayKey = claim.claimDate.slice(0, 10)
    const key = `${claim.regionId}-${dayKey}`
    const existing = regionTimeMap.get(key) || []
    existing.push(claim)
    regionTimeMap.set(key, existing)
  }

  for (const [key, group] of regionTimeMap) {
    if (group.length > 3) {
      const [regionId] = key.split('-')
      anomalies.push({
        id: generateId(),
        cubeSnapshotId: '',
        type: 'region_aggregate_conflict',
        sourceType: 'claim',
        sourceId: key,
        description: `地区 ${regionId} 在 ${key} 有 ${group.length} 笔赔付，可能存在聚合冲突`,
        severity: 'medium',
        acknowledged: false,
        detectedAt: new Date().toISOString(),
      })
    }
  }

  return anomalies
}

export function runAnomalyDetection(
  pathPoints: TyphoonPathPoint[],
  typhoonEvent: TyphoonEvent,
  claims: Claim[]
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [
    ...detectPathTimeMisalign(pathPoints, typhoonEvent),
    ...detectExtremeClaimOcclusion(claims),
    ...detectRegionAggregateConflict(claims),
  ]

  return anomalies
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  path_time_misalign: '路径时间错位',
  region_aggregate_conflict: '地区聚合冲突',
  extreme_claim_occlusion: '极端赔付遮蔽',
  source_missing: '数据源缺失',
  time_gap: '时间轴间隙',
}

export const SEVERITY_COLORS: Record<string, string> = {
  high: '#FF6B35',
  medium: '#FFD600',
  low: '#00E676',
}
