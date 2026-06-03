import { PointCloudLog, SafetyRadiusTable, ConflictRecord } from '@/types';
import { db } from '@/db';

export function detectConflicts(
  pointCloudLog: PointCloudLog,
  safetyRadiusTable: SafetyRadiusTable
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  
  for (const exhibit of pointCloudLog.exhibits) {
    const safetyEntry = safetyRadiusTable.exhibits.find(
      (e) => e.exhibitId === exhibit.exhibitId
    );
    
    if (!safetyEntry) continue;
    
    const pointCloudValue = exhibit.pointCloudRadius;
    const safetyRadiusValue = safetyEntry.safetyRadius;
    const diffValue = Math.abs(pointCloudValue - safetyRadiusValue);
    const diffPercent = pointCloudValue > 0 
      ? (diffValue / pointCloudValue) * 100 
      : 0;
    
    if (diffValue > 0.1) {
      let severity: ConflictRecord['severity'] = 'low';
      if (diffValue > 0.5 || diffPercent > 30) {
        severity = 'high';
      } else if (diffValue > 0.2 || diffPercent > 15) {
        severity = 'medium';
      }
      
      conflicts.push({
        id: `conflict_${Date.now()}_${exhibit.exhibitId}`,
        exhibitId: exhibit.exhibitId,
        exhibitName: exhibit.name,
        pointCloudValue,
        safetyRadiusValue,
        diffValue: Math.round(diffValue * 100) / 100,
        diffPercent: Math.round(diffPercent * 100) / 100,
        severity,
        status: 'pending',
        evidence: {
          pointCloudSource: pointCloudLog.filename,
          safetyRadiusSource: safetyRadiusTable.filename,
          pointCloudLogId: pointCloudLog.id,
          safetyRadiusTableId: safetyRadiusTable.id,
        },
      });
    }
  }
  
  return conflicts;
}

export async function saveConflicts(conflicts: ConflictRecord[]) {
  await Promise.all(conflicts.map((c) => db.conflicts.put(c)));
}

export async function resolveConflict(
  conflictId: string,
  decision: 'confirmed' | 'rejected',
  remark: string,
  operator: string
): Promise<ConflictRecord | null> {
  const conflict = await db.conflicts.get(conflictId);
  if (!conflict) return null;
  
  const now = new Date().toISOString();
  const updated: ConflictRecord = {
    ...conflict,
    status: decision === 'confirmed' ? 'confirmed' : 'rejected',
    decision: decision === 'confirmed' ? 'use_safety_radius' : 'use_point_cloud',
    decisionRemark: remark,
    decisionOperator: operator,
    decisionTime: now,
  };
  
  await db.conflicts.put(updated);
  
  await db.decisionLogs.put({
    id: `dl_${Date.now()}`,
    conflictId,
    operator,
    decision,
    remark,
    operateTime: now,
  });
  
  return updated;
}

export function getConflictEvidence(conflict: ConflictRecord): {
  title: string;
  pointCloud: { label: string; value: number; source: string };
  safetyRadius: { label: string; value: number; source: string };
  analysis: string;
} {
  const pointCloudSide = {
    label: '点云抽稀日志',
    value: conflict.pointCloudValue,
    source: conflict.evidence.pointCloudSource,
  };
  
  const safetyRadiusSide = {
    label: '安全半径表',
    value: conflict.safetyRadiusValue,
    source: conflict.evidence.safetyRadiusSource,
  };
  
  let analysis = '';
  if (conflict.safetyRadiusValue > conflict.pointCloudValue) {
    analysis = `安全半径表要求的半径（${conflict.safetyRadiusValue}m）比点云抽稀计算的（${conflict.pointCloudValue}m）大 ${conflict.diffValue}m（+${conflict.diffPercent}%）。如果确认按安全半径表修正，动线需要重新规划以确保满足更大的安全距离要求。`;
  } else {
    analysis = `安全半径表要求的半径（${conflict.safetyRadiusValue}m）比点云抽稀计算的（${conflict.pointCloudValue}m）小 ${conflict.diffValue}m（-${conflict.diffPercent}%）。如果确认按安全半径表修正，动线范围可以更紧凑。`;
  }
  
  if (conflict.severity === 'high') {
    analysis += ' 【高风险】差异超过30%，建议与展陈客户沟通确认后再处理。';
  } else if (conflict.severity === 'medium') {
    analysis += ' 【中风险】差异在15%-30%之间，请注意核对原始数据。';
  }
  
  return {
    title: `${conflict.exhibitName}（${conflict.exhibitId}）安全半径冲突`,
    pointCloud: pointCloudSide,
    safetyRadius: safetyRadiusSide,
    analysis,
  };
}

export function getPendingConflictsCount(conflicts: ConflictRecord[]): number {
  return conflicts.filter((c) => c.status === 'pending').length;
}

export function hasUnresolvedConflicts(conflicts: ConflictRecord[]): boolean {
  return conflicts.some((c) => c.status === 'pending');
}
