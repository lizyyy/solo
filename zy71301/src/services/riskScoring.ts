import type { AnomalyEvent, RuleConfig, RiskScoreFormula, NormalizationType } from '../types';

function normalizeValue(
  value: number,
  minVal: number,
  maxVal: number,
  normalization: NormalizationType
): number {
  let normalized = (value - minVal) / (maxVal - minVal);
  normalized = Math.max(0, Math.min(1, normalized));

  switch (normalization) {
    case 'log':
      return Math.log1p(normalized * 9) / Math.log10(10);
    case 'sqrt':
      return Math.sqrt(normalized);
    case 'linear':
    default:
      return normalized;
  }
}

export function calculateRiskScore(
  anomaly: AnomalyEvent,
  rules: RuleConfig[],
  formula: RiskScoreFormula
): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const component of formula.components) {
    const rule = rules.find((r) => r.id === component.ruleId);
    if (!rule || !rule.enabled) continue;

    let rawValue = 0;

    switch (rule.category) {
      case 'acceleration':
        rawValue = anomaly.peakAcceleration;
        break;
      case 'jerk':
        rawValue = anomaly.peakAcceleration * 2;
        break;
      case 'fps':
        rawValue = anomaly.type === 'fps_drop' ? 60 : 90;
        break;
      case 'pose':
        rawValue = anomaly.type === 'pose_jump' ? 30 : 0;
        break;
      case 'feedback':
        rawValue = anomaly.type === 'player_reported' ? 5 : 0;
        break;
    }

    const threshold =
      rule.thresholds.minValue !== undefined
        ? rule.thresholds.minValue
        : rule.thresholds.maxValue !== undefined
        ? rule.thresholds.maxValue
        : 1;

    const severityLevels = Object.values(rule.severityMapping);
    const minSeverity = Math.min(...severityLevels);
    const maxSeverity = Math.max(...severityLevels);

    const normalized = normalizeValue(
      rawValue,
      threshold,
      maxSeverity,
      component.normalization
    );

    totalScore += normalized * component.weight;
    totalWeight += component.weight;
  }

  if (totalWeight === 0) return 0;

  let finalScore = Math.round((totalScore / totalWeight) * 100);

  finalScore = Math.round(finalScore * anomaly.confidence);

  if (anomaly.type === 'player_reported') {
    finalScore = Math.min(100, finalScore + 10);
  }

  if (anomaly.reviewStatus === 'confirmed') {
    finalScore = Math.min(100, finalScore + 5);
  } else if (anomaly.reviewStatus === 'false_positive') {
    finalScore = Math.max(0, finalScore - 30);
  }

  return Math.max(0, Math.min(100, finalScore));
}

export function calculateSessionRisk(
  anomalies: AnomalyEvent[]
): { avgRisk: number; maxRisk: number; highRiskCount: number } {
  if (anomalies.length === 0) {
    return { avgRisk: 0, maxRisk: 0, highRiskCount: 0 };
  }

  const scores = anomalies.map((a) => a.riskScore);
  const avgRisk = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const maxRisk = Math.max(...scores);
  const highRiskCount = anomalies.filter((a) => a.riskScore >= 70).length;

  return { avgRisk, maxRisk, highRiskCount };
}

export function getRiskLevel(score: number): { level: string; color: string; bgColor: string } {
  if (score >= 85) {
    return { level: '极高风险', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  }
  if (score >= 70) {
    return { level: '高风险', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
  }
  if (score >= 50) {
    return { level: '中风险', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
  }
  if (score >= 30) {
    return { level: '低风险', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
  }
  return { level: '极低风险', color: 'text-green-400', bgColor: 'bg-green-500/20' };
}

export function getReviewStatusInfo(
  status: string
): { label: string; color: string; bgColor: string; icon: string } {
  switch (status) {
    case 'confirmed':
      return { label: '已确认', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: 'check' };
    case 'false_positive':
      return { label: '误报', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: 'x' };
    case 'needs_review':
      return { label: '待复核', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: 'alert' };
    case 'pending':
    default:
      return { label: '待处理', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: 'clock' };
  }
}

export function getAnomalyTypeInfo(
  type: string
): { label: string; color: string; description: string } {
  switch (type) {
    case 'high_accel':
      return { label: '高加速度', color: 'text-red-400', description: '线性加速度超过安全阈值' };
    case 'high_jerk':
      return { label: '高加加速度', color: 'text-orange-400', description: '加速度变化率过大' };
    case 'fps_drop':
      return { label: '帧率下降', color: 'text-purple-400', description: '帧率低于目标值' };
    case 'pose_jump':
      return { label: '姿态突跳', color: 'text-yellow-400', description: '头显姿态异常突变' };
    case 'player_reported':
      return { label: '玩家反馈', color: 'text-pink-400', description: '玩家主动报告的不适' };
    default:
      return { label: '未知', color: 'text-gray-400', description: '未分类异常' };
  }
}

export function generateScoreExplanation(
  anomaly: AnomalyEvent,
  rules: RuleConfig[],
  formula: RiskScoreFormula
): string[] {
  const explanations: string[] = [];

  if (anomaly.matchedRules.length > 0) {
    const matchedRuleNames = anomaly.matchedRules
      .map((id) => rules.find((r) => r.id === id)?.name || id)
      .join('、');
    explanations.push(`触发规则: ${matchedRuleNames}`);
  }

  if (anomaly.confidence < 0.7) {
    explanations.push(`置信度较低 (${(anomaly.confidence * 100).toFixed(0)}%)，已标记待复核`);
  }

  if (anomaly.duration > 3) {
    explanations.push(`持续时间较长 (${anomaly.duration.toFixed(1)}秒)，风险加权提升`);
  }

  if (anomaly.type === 'player_reported') {
    explanations.push('包含玩家主观反馈，风险加成 +10%');
  }

  return explanations;
}
