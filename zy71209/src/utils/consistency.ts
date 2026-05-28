import type { Pledge, Statistics, PledgeCalculation } from '../types';

export interface ConsistencyCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: ConsistencyDetail[];
}

export interface ConsistencyDetail {
  type: 'statistics' | 'export' | 'display';
  field: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export function validateStatisticsConsistency(
  pledges: Pledge[],
  calculations: Map<string, PledgeCalculation>,
  statistics: Statistics
): ConsistencyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: ConsistencyDetail[] = [];

  const today = new Date().toISOString().split('T')[0];

  const closePledges = pledges.filter((p) => {
    const calc = calculations.get(p.id);
    return calc?.isClose;
  });

  if (closePledges.length !== statistics.totalClose) {
    errors.push(
      `平仓总数不一致：统计显示${statistics.totalClose}，实际计算${closePledges.length}`
    );
    details.push({
      type: 'statistics',
      field: 'totalClose',
      expected: statistics.totalClose.toString(),
      actual: closePledges.length.toString(),
      passed: false,
    });
  } else {
    details.push({
      type: 'statistics',
      field: 'totalClose',
      expected: statistics.totalClose.toString(),
      actual: closePledges.length.toString(),
      passed: true,
    });
  }

  const warningPledges = pledges.filter((p) => {
    const calc = calculations.get(p.id);
    return calc?.isWarning && !calc?.isClose;
  });

  if (warningPledges.length !== statistics.totalWarning) {
    errors.push(
      `预警总数不一致：统计显示${statistics.totalWarning}，实际计算${warningPledges.length}`
    );
    details.push({
      type: 'statistics',
      field: 'totalWarning',
      expected: statistics.totalWarning.toString(),
      actual: warningPledges.length.toString(),
      passed: false,
    });
  } else {
    details.push({
      type: 'statistics',
      field: 'totalWarning',
      expected: statistics.totalWarning.toString(),
      actual: warningPledges.length.toString(),
      passed: true,
    });
  }

  const todayTriggeredPledges = pledges.filter((p) => {
    const calc = calculations.get(p.id);
    const updatedAtDate = p.updatedAt?.split('T')[0];
    return (calc?.isWarning || calc?.isClose) && updatedAtDate === today;
  });

  if (todayTriggeredPledges.length !== statistics.todayTriggered) {
    errors.push(
      `今日触线数不一致：统计显示${statistics.todayTriggered}，实际计算${todayTriggeredPledges.length}`
    );
    details.push({
      type: 'statistics',
      field: 'todayTriggered',
      expected: statistics.todayTriggered.toString(),
      actual: todayTriggeredPledges.length.toString(),
      passed: false,
    });
  } else {
    details.push({
      type: 'statistics',
      field: 'todayTriggered',
      expected: statistics.todayTriggered.toString(),
      actual: todayTriggeredPledges.length.toString(),
      passed: true,
    });
  }

  const pendingSupplementCount = pledges.filter((p) =>
    p.specialFlags.includes('supplement_pending')
  ).length;

  if (pendingSupplementCount !== statistics.pendingSupplement) {
    errors.push(
      `待补仓数不一致：统计显示${statistics.pendingSupplement}，实际${pendingSupplementCount}`
    );
    details.push({
      type: 'statistics',
      field: 'pendingSupplement',
      expected: statistics.pendingSupplement.toString(),
      actual: pendingSupplementCount.toString(),
      passed: false,
    });
  } else {
    details.push({
      type: 'statistics',
      field: 'pendingSupplement',
      expected: statistics.pendingSupplement.toString(),
      actual: pendingSupplementCount.toString(),
      passed: true,
    });
  }

  const pendingExtensionCount = pledges.filter((p) =>
    p.specialFlags.includes('extension_pending')
  ).length;

  if (pendingExtensionCount !== statistics.pendingExtension) {
    errors.push(
      `待展期数不一致：统计显示${statistics.pendingExtension}，实际${pendingExtensionCount}`
    );
    details.push({
      type: 'statistics',
      field: 'pendingExtension',
      expected: statistics.pendingExtension.toString(),
      actual: pendingExtensionCount.toString(),
      passed: false,
    });
  } else {
    details.push({
      type: 'statistics',
      field: 'pendingExtension',
      expected: statistics.pendingExtension.toString(),
      actual: pendingExtensionCount.toString(),
      passed: true,
    });
  }

  const pendingDisposalCount = pledges.filter((p) => p.status === 'close').length;

  if (pendingDisposalCount !== statistics.pendingDisposal) {
    errors.push(
      `待处置数不一致：统计显示${statistics.pendingDisposal}，实际${pendingDisposalCount}`
    );
    details.push({
      type: 'statistics',
      field: 'pendingDisposal',
      expected: statistics.pendingDisposal.toString(),
      actual: pendingDisposalCount.toString(),
      passed: false,
    });
  } else {
    details.push({
      type: 'statistics',
      field: 'pendingDisposal',
      expected: statistics.pendingDisposal.toString(),
      actual: pendingDisposalCount.toString(),
      passed: true,
    });
  }

  const specialCasesCount = pledges.filter((p) => p.specialFlags.length > 0).length;

  if (specialCasesCount !== statistics.specialCases) {
    warnings.push(
      `特殊场景数不一致：统计显示${statistics.specialCases}，实际${specialCasesCount}`
    );
    details.push({
      type: 'statistics',
      field: 'specialCases',
      expected: statistics.specialCases.toString(),
      actual: specialCasesCount.toString(),
      passed: false,
    });
  } else {
    details.push({
      type: 'statistics',
      field: 'specialCases',
      expected: statistics.specialCases.toString(),
      actual: specialCasesCount.toString(),
      passed: true,
    });
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    details,
  };
}

export function validatePledgeCalculationConsistency(
  pledge: Pledge,
  calculation: PledgeCalculation
): ConsistencyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: ConsistencyDetail[] = [];

  const expectedIsWarning = calculation.pledgeRatio >= calculation.effectiveWarningLine;
  if (expectedIsWarning !== calculation.isWarning) {
    errors.push(
      `预警状态不一致：计算质押率${calculation.pledgeRatio.toFixed(2)}% >= 警戒线${calculation.effectiveWarningLine.toFixed(2)}%，应为${expectedIsWarning ? '预警' : '正常'}`
    );
  }

  const expectedIsClose = calculation.pledgeRatio >= pledge.closeLine;
  if (expectedIsClose !== calculation.isClose) {
    errors.push(
      `平仓状态不一致：计算质押率${calculation.pledgeRatio.toFixed(2)}% >= 平仓线${pledge.closeLine.toFixed(2)}%，应为${expectedIsClose ? '平仓' : '正常'}`
    );
  }

  const expectedMarketValue = pledge.pledgeShares * calculation.effectivePrice;
  if (Math.abs(expectedMarketValue - calculation.marketValue) > 0.01) {
    errors.push(
      `市值计算不一致：${pledge.pledgeShares} × ${calculation.effectivePrice.toFixed(2)} = ${expectedMarketValue.toFixed(2)}，实际${calculation.marketValue.toFixed(2)}`
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    details,
  };
}

export function validateExportConsistency(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportData: any[],
  sourceData: Pledge[],
  calculations: Map<string, PledgeCalculation>
): ConsistencyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: ConsistencyDetail[] = [];

  if (exportData.length !== sourceData.length) {
    errors.push(`导出数据行数不一致：源数据${sourceData.length}行，导出${exportData.length}行`);
  }

  exportData.forEach((row, index) => {
    const pledge = sourceData[index];
    const calc = calculations.get(pledge.id);

    if (calc && row.质押率 !== undefined) {
      const expectedRatio = `${calc.pledgeRatio.toFixed(2)}%`;
      if (row.质押率 !== expectedRatio) {
        errors.push(`第${index + 1}行质押率不一致：导出${row.质押率}，实际${expectedRatio}`);
      }
    }
  });

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    details,
  };
}

export function getConsistencyReport(result: ConsistencyCheckResult): string {
  const lines: string[] = [];
  lines.push(`数据一致性校验 ${result.passed ? '通过' : '未通过'}`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('错误：');
    result.errors.forEach((e) => lines.push(`  ❌ ${e}`));
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('警告：');
    result.warnings.forEach((w) => lines.push(`  ⚠️  ${w}`));
    lines.push('');
  }

  lines.push('详细信息：');
  result.details.forEach((d) => {
    const status = d.passed ? '✅' : '❌';
    lines.push(`  ${status} [${d.type}] ${d.field}: 预期=${d.expected}, 实际=${d.actual}`);
  });

  return lines.join('\n');
}
