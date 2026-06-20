import type { FilterCriteria, Problem, ReviewResult } from '@/types';

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

export function findProblematicRows(
  problems: Problem[],
  results: ReviewResult[]
): { rowNumber: number; problemId: string; title: string; deviation: number }[] {
  return results
    .filter((r) => r.status === 'abnormal')
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 5)
    .map((r) => {
      const problem = problems.find((p) => p.id === r.problemId);
      return {
        rowNumber: problem?.originalRow || 0,
        problemId: r.problemId,
        title: problem?.title || '未知题目',
        deviation: r.deviation,
      };
    });
}
