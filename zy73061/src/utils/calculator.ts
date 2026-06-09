import type { ThresholdRule, WarningLevel, CalculationStep } from '@/types';

export function evaluateWarning(
  value: number,
  rule: ThresholdRule,
): { level: WarningLevel; steps: CalculationStep[] } {
  const steps: CalculationStep[] = [];
  let calculated = value;

  if (rule.metric === '管线工作压力' && rule.formula_version === 'v2.3') {
    const K = 0.97;
    steps.push({
      step: 1,
      title: '读取原始测量值',
      expression: `P_measured = ${value} ${rule.unit}`,
      result: value,
      unit: rule.unit,
    });
    steps.push({
      step: 2,
      title: '应用温度补偿系数（高温环境 K_temperature=0.97）',
      expression: `P_actual = ${value} × ${K}`,
      result: Number((value * K).toFixed(2)),
      unit: rule.unit,
    });
    calculated = Number((value * K).toFixed(2));
  } else if (rule.metric === '介质温度') {
    const T_ambient = 32;
    steps.push({
      step: 1,
      title: '读取红外测温值',
      expression: `T_measured = ${value} ${rule.unit}`,
      result: value,
      unit: rule.unit,
    });
    steps.push({
      step: 2,
      title: '扣除环境温度并加基准',
      expression: `T_rated = ${value} - ${T_ambient} + 25`,
      result: value - T_ambient + 25,
      unit: rule.unit,
    });
    calculated = value - T_ambient + 25;
  } else {
    steps.push({
      step: 1,
      title: '读取测量值（无换算）',
      expression: `V = ${value} ${rule.unit}`,
      result: value,
      unit: rule.unit,
    });
  }

  steps.push({
    step: steps.length + 1,
    title: '与阈值边界对比',
    expression: `下限${rule.lower_bound} ≤ 计算值${calculated} ≤ 上限${rule.upper_bound}；预警区间 [${rule.warning_low}, ${rule.warning_high}]`,
    result: calculated,
    unit: rule.unit,
  });

  let level: WarningLevel = 'green';
  if (calculated < rule.lower_bound || calculated > rule.upper_bound) {
    level = 'red';
  } else if (calculated < rule.warning_low || calculated > rule.warning_high) {
    level = 'yellow';
  }

  steps.push({
    step: steps.length + 1,
    title: '预警等级判定',
    expression: level === 'red' ? '超出边界→红警' : level === 'yellow' ? '进入预警区间→黄警' : '正常范围内→绿区',
    result: calculated,
    unit: rule.unit,
  });

  return { level, steps };
}

export function getCurrentVersionRules(rules: ThresholdRule[]): ThresholdRule[] {
  const currentVersions = rules.filter((r) => r.formula_version === 'v2.3');
  return currentVersions.length > 0 ? currentVersions : rules;
}

export function findRuleByMetric(
  rules: ThresholdRule[],
  metric: string,
  version = 'v2.3',
): ThresholdRule | undefined {
  return rules.find((r) => r.metric === metric && r.formula_version === version);
}
