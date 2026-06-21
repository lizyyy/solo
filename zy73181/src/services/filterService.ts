import type { FilterCriteria, Problem, ReviewResult, ProblematicRowInfo } from '@/types';
import { statusLabel } from '@/engine/boundaryReviewEngine';

export function generateFilterSummary(criteria: FilterCriteria): string {
  const parts: string[] = [];

  if (criteria.difficulties.length > 0) {
    const labels = criteria.difficulties.map(difficultyLabel);
    parts.push(`难度：${labels.join('、')}`);
  }

  if (criteria.constraintTypes.length > 0) {
    const labels = criteria.constraintTypes.map(constraintTypeLabel);
    parts.push(`约束类型：${labels.join('、')}`);
  }

  if (criteria.reviewStatuses.length > 0) {
    const labels = criteria.reviewStatuses.map(reviewStatusLabel);
    parts.push(`复核状态：${labels.join('、')}`);
  }

  if (criteria.showUnitIssuesOnly) {
    parts.push('仅显示单位问题');
  }

  if (criteria.keyword) {
    parts.push(`关键词：${criteria.keyword}`);
  }

  if (parts.length === 0) {
    return '全部数据（无筛选）';
  }

  return parts.join(' | ');
}

export function difficultyLabel(d: string): string {
  const map: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
    expert: '专家',
  };
  return map[d] || d;
}

export function constraintTypeLabel(t: string): string {
  const map: Record<string, string> = {
    linear: '线性规划',
    nonlinear: '非线性规划',
    integer: '整数规划',
    binary: '0-1规划',
  };
  return map[t] || t;
}

export function reviewStatusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: '待复核',
    normal: '正常',
    abnormal: '异常',
    unit_issue: '单位问题',
    skipped: '已跳过',
  };
  return map[s] || s;
}

export function reviewResultStatusLabel(s: string): string {
  const map: Record<string, string> = {
    normal: '正常',
    abnormal: '异常',
    unit_issue: '单位问题',
    skipped: '已跳过',
  };
  return map[s] || s;
}

export function unitCheckResultLabel(r: string): string {
  const map: Record<string, string> = {
    pass: '通过',
    missing: '缺失',
    mismatch: '不匹配',
    conversion_error: '换算错误',
  };
  return map[r] || r;
}

export function remarkStatusLabel(s: ProblematicRowInfo['remarkStatus']): string {
  const map = { none: '无备注', normal: '有备注', supplementary: '后补备注' } as const;
  return map[s];
}

export function unitStatusLabel(s: ProblematicRowInfo['unitStatus']): string {
  const map = { present: '完整', missing: '缺失', mismatch: '不匹配' } as const;
  return map[s];
}

function toJudgment(r?: ReviewResult): ProblematicRowInfo['judgmentA'] {
  if (!r) return 'pending';
  if (r.status === 'unit_issue') return 'unit_issue';
  if (r.status === 'abnormal') return 'abnormal';
  if (r.status === 'normal') return 'normal';
  return 'pending';
}

export function buildProblematicRowInfo(
  problem: Problem,
  resultA?: ReviewResult,
  resultB?: ReviewResult,
): ProblematicRowInfo {
  const active = resultB || resultA;
  const sd = active?.stepDetail;
  const remarkStatus: ProblematicRowInfo['remarkStatus'] = problem.isRemarkSupplementary
    ? 'supplementary'
    : problem.remark
      ? 'normal'
      : 'none';
  let unitStatus: ProblematicRowInfo['unitStatus'] = 'present';
  if (problem.hasUnitIssue || problem.boundaryUnit == null) unitStatus = 'missing';
  else if (active?.unitCheckResult === 'mismatch') unitStatus = 'mismatch';

  const jA = toJudgment(resultA);
  const jB = toJudgment(resultB);

  return {
    id: active?.id || `info-${problem.id}`,
    problemId: problem.id,
    originalRow: problem.originalRow,
    title: problem.title,
    deviation: active?.deviation ?? 0,
    deviationAbs: Math.abs(active?.deviation ?? 0),
    remarkStatus,
    unitStatus,
    rawBoundaryValue: problem.boundaryValue as number | null,
    rawBoundaryUnit: problem.boundaryUnit,
    convertedValue: sd?.convertedValue ?? null,
    convertedUnit: sd?.convertedUnit ?? null,
    judgmentA: jA,
    judgmentB: jB,
    judgmentChanged: resultA && resultB ? jA !== jB : false,
    changedJudgments: active?.changedJudgments ?? [],
  };
}

export function findProblematicRows(
  problems: Problem[],
  resultsA: ReviewResult[],
  resultsB: ReviewResult[],
  activeGroup: 'A' | 'B' = 'A',
): ProblematicRowInfo[] {
  const active = activeGroup === 'A' ? resultsA : resultsB;
  return active
    .filter((r) => r.status === 'abnormal')
    .map((r) => {
      const problem = problems.find((p) => p.id === r.problemId)!;
      const rA = resultsA.find((x) => x.problemId === r.problemId);
      const rB = resultsB.find((x) => x.problemId === r.problemId);
      return buildProblematicRowInfo(problem, rA, rB);
    })
    .sort((a, b) => b.deviationAbs - a.deviationAbs)
    .slice(0, 5);
}

export function findUnitIssueRows(
  problems: Problem[],
  resultsA: ReviewResult[],
  resultsB: ReviewResult[],
  activeGroup: 'A' | 'B' = 'A',
): ProblematicRowInfo[] {
  const active = activeGroup === 'A' ? resultsA : resultsB;
  const unitIssueIds = new Set<string>();
  active
    .filter((r) => r.status === 'unit_issue')
    .forEach((r) => unitIssueIds.add(r.problemId));
  problems.forEach((p) => {
    if (p.hasUnitIssue) unitIssueIds.add(p.id);
  });
  return Array.from(unitIssueIds)
    .map((id) => {
      const problem = problems.find((p) => p.id === id)!;
      const rA = resultsA.find((x) => x.problemId === id);
      const rB = resultsB.find((x) => x.problemId === id);
      return buildProblematicRowInfo(problem, rA, rB);
    })
    .sort((a, b) => a.originalRow - b.originalRow);
}

export function judgmentLabel(j: ProblematicRowInfo['judgmentA']): string {
  return statusLabel(j);
}

