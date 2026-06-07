import type { PointLocation, AnomalyRecord, SchemePoint, PointStatus } from '@/types';

export interface StatisticsResult {
  totalPoints: number;
  passCount: number;
  confirmCount: number;
  legacyCount: number;
  totalAnomalies: number;
  unresolvedAnomalies: number;
  nonPassPoints: number;
  passRate: string;
  anomalyRate: string;
}

export interface ConsistencyCheckResult {
  isConsistent: boolean;
  issues: string[];
  summary: string;
}

export function calculateStatistics(
  points: PointLocation[],
  anomalies: AnomalyRecord[]
): StatisticsResult {
  const totalPoints = points.length;
  const passCount = points.filter((p) => p.status === 'pass').length;
  const confirmCount = points.filter((p) => p.status === 'confirm').length;
  const legacyCount = points.filter((p) => p.status === 'legacy').length;
  const nonPassPoints = points.filter((p) => p.status !== 'pass').length;
  const totalAnomalies = anomalies.length;
  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved).length;
  const passRate = totalPoints > 0 ? ((passCount / totalPoints) * 100).toFixed(1) + '%' : '0%';
  const anomalyRate = totalPoints > 0 ? ((nonPassPoints / totalPoints) * 100).toFixed(1) + '%' : '0%';

  return {
    totalPoints,
    passCount,
    confirmCount,
    legacyCount,
    totalAnomalies,
    unresolvedAnomalies,
    nonPassPoints,
    passRate,
    anomalyRate,
  };
}

export function checkConsistency(
  points: PointLocation[],
  anomalies: AnomalyRecord[],
  schemePoints: SchemePoint[]
): ConsistencyCheckResult {
  const issues: string[] = [];

  const statusCounts = points.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sumStatus = (statusCounts['pass'] || 0) + (statusCounts['confirm'] || 0) + (statusCounts['legacy'] || 0);
  if (sumStatus !== points.length) {
    issues.push(`状态分类合计(${sumStatus})与总点位(${points.length})不一致`);
  }

  const anomalyPointIds = new Set(anomalies.map((a) => a.pointId));
  const nonPassPointIds = new Set(points.filter((p) => p.status !== 'pass').map((p) => p.id));

  const anomalyWithoutNonPass = [...anomalyPointIds].filter((id) => !nonPassPointIds.has(id));
  if (anomalyWithoutNonPass.length > 0) {
    issues.push(`存在异常记录但点位状态为通过: ${anomalyWithoutNonPass.join(', ')}`);
  }

  const nonPassWithoutAnomaly = [...nonPassPointIds].filter((id) => !anomalyPointIds.has(id));
  if (nonPassWithoutAnomaly.length > 0) {
    issues.push(`存在非通过状态但无异常记录: ${nonPassWithoutAnomaly.join(', ')}`);
  }

  const invalidSchemePoints = schemePoints.filter(
    (sp) => !points.some((p) => p.id === sp.pointId)
  );
  if (invalidSchemePoints.length > 0) {
    issues.push(`方案覆盖引用不存在点位: ${invalidSchemePoints.map((sp) => sp.pointId).join(', ')}`);
  }

  const pointsWithoutOriginalSource = points.filter((p) => !p.originalSource || p.originalSource.trim() === '');
  if (pointsWithoutOriginalSource.length > 0) {
    issues.push(`缺少原始来源: ${pointsWithoutOriginalSource.map((p) => p.id).join(', ')}`);
  }

  const pointsWithoutProcessTime = points.filter((p) => !p.processTime || p.processTime.trim() === '');
  if (pointsWithoutProcessTime.length > 0) {
    issues.push(`缺少处理时间: ${pointsWithoutProcessTime.map((p) => p.id).join(', ')}`);
  }

  const isConsistent = issues.length === 0;
  let summary = '';
  if (isConsistent) {
    summary = `一致性校验通过：${points.length}个点位/${anomalies.length}条异常记录，状态分类完整，异常与非通过点位一一对应，来源和时间字段齐全`;
  } else {
    summary = `一致性校验发现${issues.length}个问题：${issues[0]}`;
  }

  return { isConsistent, issues, summary };
}

export function getPointDisplayNote(
  point: PointLocation,
  schemePoint?: SchemePoint,
  anomaly?: AnomalyRecord
): string {
  if (schemePoint?.overrideNote && schemePoint.overrideNote.trim()) {
    return schemePoint.overrideNote;
  }
  if (anomaly?.processNote && anomaly.processNote.trim()) {
    return anomaly.processNote;
  }
  return point.processNote || '';
}

export function filterPoints(
  points: PointLocation[],
  filterStatus: PointStatus[],
  filterSource: string[]
): PointLocation[] {
  return points.filter(
    (p) => filterStatus.includes(p.status) && filterSource.includes(p.source)
  );
}
