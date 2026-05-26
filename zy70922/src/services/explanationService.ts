import { Discrepancy, DiscrepancyType, SampleRecord, InspectionItem } from '../types';
import { getOne, getAll } from '../database';
import { getInspectionItemsBySample } from './reconciliationService';

export interface DiscrepancyExplanation {
  discrepancyId: string;
  type: DiscrepancyType;
  typeLabel: string;
  severity: string;
  severityLabel: string;
  description: string;
  sampleNo: string;
  batchId: string;
  sourceField: string;
  expectedValue?: string;
  actualValue?: string;
  evidence: any;
  rootCause: string;
  impact: string;
  suggestedActions: string[];
  relatedSamples: string[];
  timeline: Array<{ date: string; event: string }>;
  requiresManualReview: boolean;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

const TYPE_LABELS: Record<DiscrepancyType, string> = {
  mixed_batch: '样品混批',
  retest_window: '复检窗口超时',
  report_withdrawn: '报告撤回',
  project_mismatch: '检测项目不匹配',
  value_out_of_range: '检测值超标',
  duplicate_sample: '重复样品',
  missing_data: '数据缺失',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const TYPE_ROOT_CAUSES: Record<DiscrepancyType, string> = {
  mixed_batch: '合作社送样时可能将不同批次的样品混装，或样品编号重复使用导致系统识别为同一批样品',
  retest_window: '复检未在规定时间窗口内完成，可能由于实验室排期、人员调配或设备问题导致延迟',
  report_withdrawn: '原报告已被撤回，可能由于检测结果存疑、客户申诉或质量审核发现问题',
  project_mismatch: '检测项目与合同要求不符，或触发复检规则但未执行复检流程',
  value_out_of_range: '样品检测值超出标准限值，可能由样品本身质量问题或检测操作误差导致',
  duplicate_sample: '同一批次中存在重复的样品编号，可能是导入时重复或送样单填写错误',
  missing_data: '样品记录或检测项目数据不完整，可能是导入失败、系统故障或文件损坏',
};

const TYPE_IMPACTS: Record<DiscrepancyType, string> = {
  mixed_batch: '可能导致检测结果无法准确归因到具体批次，影响质量追溯和问题定位',
  retest_window: '复检结果的有效性可能受到质疑，影响报告的法律效力和客户信任',
  report_withdrawn: '已出具的报告无效，需要重新检测或补充材料，可能影响客户业务进度',
  project_mismatch: '检测结果不完整，无法满足合同或标准要求，需要补做检测项目',
  value_out_of_range: '样品可能不合格，需要进一步确认或整批判定为不合格产品',
  duplicate_sample: '可能导致统计数据不准确，影响批次合格率和质量评估',
  missing_data: '无法完成完整的对账流程，需要补充导入缺失的数据',
};

const TYPE_SUGGESTIONS: Record<DiscrepancyType, string[]> = {
  mixed_batch: [
    '联系合作社确认样品实际批次信息',
    '核对送样单和样品标签的批次编号',
    '如确认混批，建议按实际批次拆分样品记录',
    '更新样品编号规则以避免重复',
  ],
  retest_window: [
    '核查复检延迟的具体原因',
    '如为客观因素（设备故障、不可抗力），可备注说明后放行',
    '如为管理疏漏，建议优化复检流程和时间监控',
    '考虑是否需要重新采样检测',
  ],
  report_withdrawn: [
    '查看原报告撤回的原因记录',
    '确认是否已完成重新检测',
    '如已重测，核对新检测结果是否在合格范围内',
    '必要时与客户沟通说明情况',
  ],
  project_mismatch: [
    '核对合同和检测方案，确认是否遗漏检测项目',
    '如触发复检规则，确认未复检的原因',
    '必要时安排补做检测项目',
    '更新自动复检提醒机制',
  ],
  value_out_of_range: [
    '复核原始检测记录和仪器数据',
    '确认是否为检测操作误差或仪器偏差',
    '如确认超标，根据标准要求判定是否需要复检',
    '与合作社沟通样品质量情况',
  ],
  duplicate_sample: [
    '核对送样单和导入记录，确认是否重复导入',
    '删除重复记录，保留正确的一条',
    '如为同一样品多次送检，标记为复检样品',
  ],
  missing_data: [
    '检查原始导入文件是否完整',
    '确认是否所有样品和检测项目都已导入',
    '重新导入缺失的数据',
    '如文件损坏，联系合作社重新提供',
  ],
};

export function explainDiscrepancy(discrepancy: Discrepancy): DiscrepancyExplanation {
  let evidence: any = {};
  try {
    evidence = JSON.parse(discrepancy.evidence || '{}');
  } catch {
    evidence = { raw: discrepancy.evidence };
  }

  return {
    discrepancyId: discrepancy.id,
    type: discrepancy.type,
    typeLabel: TYPE_LABELS[discrepancy.type] || discrepancy.type,
    severity: discrepancy.severity,
    severityLabel: SEVERITY_LABELS[discrepancy.severity] || discrepancy.severity,
    description: discrepancy.description,
    sampleNo: discrepancy.sample_no,
    batchId: discrepancy.batch_id,
    sourceField: discrepancy.source_field || '',
    expectedValue: discrepancy.expected_value,
    actualValue: discrepancy.actual_value,
    evidence,
    rootCause: TYPE_ROOT_CAUSES[discrepancy.type] || '待确认',
    impact: TYPE_IMPACTS[discrepancy.type] || '影响待评估',
    suggestedActions: TYPE_SUGGESTIONS[discrepancy.type] || ['请联系技术支持'],
    relatedSamples: [],
    timeline: [],
    requiresManualReview: !!discrepancy.requires_manual_review,
    resolved: !!discrepancy.resolved,
    resolvedBy: discrepancy.resolved_by,
    resolvedAt: discrepancy.resolved_at,
    resolutionNote: discrepancy.resolution_note,
  };
}

export async function getSampleDiscrepanciesWithExplanation(
  reconciliationId: string,
  sampleNo: string
): Promise<DiscrepancyExplanation[]> {
  const discrepancies = await getAll<Discrepancy>(
    `SELECT * FROM discrepancies WHERE reconciliation_id = ? AND sample_no = ? ORDER BY severity DESC`,
    [reconciliationId, sampleNo]
  );

  return discrepancies.map(d => explainDiscrepancy(d));
}

export async function getAllDiscrepanciesWithExplanation(
  reconciliationId: string
): Promise<DiscrepancyExplanation[]> {
  const discrepancies = await getAll<Discrepancy>(
    `SELECT * FROM discrepancies WHERE reconciliation_id = ? ORDER BY severity DESC, created_at`,
    [reconciliationId]
  );

  return discrepancies.map(d => explainDiscrepancy(d));
}

export interface DecisionSupport {
  canApprove: boolean;
  canReject: boolean;
  canRequestSupplement: boolean;
  warnings: string[];
  recommendation: string;
  justification: string[];
}

export async function getDecisionSupport(
  sampleNo: string,
  batchId: string,
  reconciliationId: string
): Promise<DecisionSupport> {
  const sample = await getOne<SampleRecord>(
    `SELECT * FROM sample_records WHERE sample_no = ? AND batch_id = ?`,
    [sampleNo, batchId]
  );

  const items = await getInspectionItemsBySample(sampleNo, batchId);
  const discrepancies = await getAll<Discrepancy>(
    `SELECT * FROM discrepancies WHERE reconciliation_id = ? AND sample_no = ? AND resolved = 0`,
    [reconciliationId, sampleNo]
  );

  const warnings: string[] = [];
  const justification: string[] = [];

  const hasUnresolvedHigh = discrepancies.some(d => d.severity === 'high' || d.severity === 'critical');
  const hasUnresolvedMedium = discrepancies.some(d => d.severity === 'medium');
  const hasFailedItems = items.some(i => i.result === 'fail');
  const hasMissingRetest = items.some(i => i.result === 'fail' && !i.is_retest);

  if (hasUnresolvedHigh) {
    warnings.push('存在未解决的高严重程度差异');
  }
  if (hasUnresolvedMedium) {
    warnings.push('存在未解决的中等严重程度差异');
  }
  if (hasFailedItems) {
    warnings.push('存在检测不合格的项目');
  }
  if (hasMissingRetest) {
    warnings.push('存在不合格项目未进行复检');
  }

  let recommendation = 'review';
  if (!hasUnresolvedHigh && !hasUnresolvedMedium && !hasFailedItems) {
    recommendation = 'approve';
    justification.push('所有检测项目合格，无未解决差异');
  } else if (hasUnresolvedHigh || hasFailedItems) {
    recommendation = 'supplement';
    justification.push('需要补充材料或复检以确认结果');
  }

  return {
    canApprove: !hasUnresolvedHigh,
    canReject: hasFailedItems || hasUnresolvedHigh,
    canRequestSupplement: true,
    warnings,
    recommendation,
    justification,
  };
}
