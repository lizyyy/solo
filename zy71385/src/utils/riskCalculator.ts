import type {
  FeatureFlag,
  CodeReference,
  EnvironmentStatus,
  RiskAssessment,
  RiskLevel,
  RiskReason,
  SuggestedAction,
  RuleConfig,
} from '../types';

const DEFAULT_RULES: RuleConfig[] = [
  {
    id: '1',
    ruleKey: 'risk.stale_days',
    ruleName: '过期开关阈值',
    description: '上线超过多少天且全量开启的开关标记为可清理',
    explanation: '该规则用于识别长期稳定运行的功能开关。通常功能全量上线后观察180天确认无问题，即可安全清理开关代码。',
    value: 180,
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    ruleKey: 'risk.gray_user_threshold',
    ruleName: '灰度用户告警阈值',
    description: '灰度用户数超过多少时标记为阻塞项',
    explanation: '当生产环境仍有大量灰度用户时，直接删除开关可能影响这部分用户的使用体验。默认阈值10人，可根据业务场景调整。',
    value: 10,
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    ruleKey: 'risk.ownership_required',
    ruleName: '是否要求负责人',
    description: '未登记负责人的开关是否提升风险等级',
    explanation: '缺少负责人意味着清理影响范围无法确认。开启后，无负责人的开关风险等级将自动提升一级。',
    value: true,
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    ruleKey: 'scan.dynamic_patterns',
    ruleName: '动态引用检测模式',
    description: '用于检测通过变量拼接等方式动态获取开关的代码模式',
    explanation: '静态扫描无法检测通过字符串拼接、变量名动态生成的开关引用。配置常见的动态访问模式可降低漏检率，{key}会被替换为开关名。',
    value: ['getFlag\\([\'"]{key}[\'"]\\)', 'flags\\[[\'"]{key}[\'"]\\)', 'getFeature[\'"]{key}[\'"]'],
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    ruleKey: 'scan.exclude_dirs',
    ruleName: '扫描排除目录',
    description: '代码扫描时跳过的目录，提升扫描速度',
    explanation: '第三方依赖、构建产物、版本控制目录等不包含业务代码，扫描这些目录会浪费时间且可能产生误报。',
    value: ['node_modules', '.git', 'dist', 'build', '.next', '.cache'],
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '6',
    ruleKey: 'cleanup.require_approval',
    ruleName: '清理是否需要审批',
    description: '高风险开关清理是否需要负责人审批',
    explanation: '高风险开关涉及核心业务链路，开启后需要负责人二次确认才能执行清理，防止误删造成线上故障。',
    value: true,
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: '7',
    ruleKey: 'import.default_strategy',
    ruleName: '导入默认策略',
    description: '重复开关导入时的默认处理方式',
    explanation: '当导入的开关已存在时，ask表示弹窗询问用户，skip跳过不覆盖，overwrite直接覆盖现有数据，append作为新版本追加历史。',
    value: 'ask',
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
];

export function getDefaultRules(): RuleConfig[] {
  return DEFAULT_RULES;
}

export function getRuleValue(rules: RuleConfig[], key: string): any {
  const rule = rules.find(r => r.ruleKey === key && r.enabled);
  return rule?.value;
}

function hasDynamicReference(refs: CodeReference[]): boolean {
  return refs.some(r => r.matchType === 'dynamic');
}

function hasSuspectedDynamicReference(refs: CodeReference[]): boolean {
  return refs.some(r => r.matchType === 'suspected');
}

function hasGrayUsers(envStatuses: EnvironmentStatus[], threshold: number): boolean {
  return envStatuses.some(e => e.grayUsers > threshold);
}

function hasHighGrayUsers(envStatuses: EnvironmentStatus[]): boolean {
  return envStatuses.some(e => e.environment === 'production' && e.grayUsers > 100);
}

function isAllEnabled(envStatuses: EnvironmentStatus[]): boolean {
  return envStatuses.every(e => e.enabled && e.grayPercentage === 100);
}

function hasEnvInconsistency(envStatuses: EnvironmentStatus[]): boolean {
  if (envStatuses.length < 2) return false;
  const firstValue = envStatuses[0].value;
  const firstEnabled = envStatuses[0].enabled;
  return envStatuses.some(e => e.value !== firstValue || e.enabled !== firstEnabled);
}

export function assessRisk(
  flag: FeatureFlag,
  codeReferences: CodeReference[],
  environmentStatuses: EnvironmentStatus[],
  rules: RuleConfig[] = DEFAULT_RULES
): RiskAssessment {
  const reasons: RiskReason[] = [];
  let level: RiskLevel = 'low';
  let suggestedAction: SuggestedAction = 'safe_delete';

  const staleDays = getRuleValue(rules, 'risk.stale_days') || 180;
  const grayThreshold = getRuleValue(rules, 'risk.gray_user_threshold') || 10;
  const ownershipRequired = getRuleValue(rules, 'risk.ownership_required') !== false;

  const staleLaunchDate = flag.launchDate 
    ? (new Date().getTime() - new Date(flag.launchDate).getTime()) / (1000 * 60 * 60 * 24) > staleDays
    : false;
  const allEnabled = isAllEnabled(environmentStatuses);
  const hasDynamic = hasDynamicReference(codeReferences);
  const hasSuspectedDynamic = hasSuspectedDynamicReference(codeReferences);
  const hasGray = hasGrayUsers(environmentStatuses, grayThreshold);
  const hasHighGray = hasHighGrayUsers(environmentStatuses);
  const envInconsistent = hasEnvInconsistency(environmentStatuses);
  const missingOwner = !flag.owner;

  if (hasDynamic) {
    reasons.push({
      code: 'DYNAMIC_REF_DETECTED',
      message: `检测到 ${codeReferences.filter(r => r.matchType === 'dynamic').length} 处动态引用`,
      severity: 'error',
      suggestion: '⚠️ 该开关通过变量名动态拼接引用，静态扫描无法完全覆盖。建议全局搜索开关名的关键词片段进行人工确认。',
    });
    level = 'blocker';
    suggestedAction = 'do_not_delete';
  }

  if (hasHighGray) {
    const prodEnv = environmentStatuses.find(e => e.environment === 'production');
    reasons.push({
      code: 'HIGH_GRAY_USERS',
      message: `生产环境仍有 ${prodEnv?.grayUsers || 0} 位灰度用户`,
      severity: 'error',
      suggestion: `⚠️ 生产环境仍有 ${prodEnv?.grayUsers || 0} 位灰度用户在使用此开关控制的功能，直接删除可能影响这部分用户体验。建议先全量或灰度下线后再清理。`,
    });
    level = 'blocker';
    suggestedAction = 'do_not_delete';
  }

  if (missingOwner && ownershipRequired) {
    reasons.push({
      code: 'MISSING_OWNER',
      message: '该开关未登记负责人',
      severity: 'warning',
      suggestion: '⚠️ 该开关未登记负责人，无法确认清理影响范围。建议联系该模块最近的代码提交者补充信息。',
    });
    if (level === 'low') level = 'medium';
  }

  if (hasSuspectedDynamic && level !== 'blocker') {
    reasons.push({
      code: 'SUSPECTED_DYNAMIC_REF',
      message: `存在 ${codeReferences.filter(r => r.matchType === 'suspected').length} 处疑似动态引用`,
      severity: 'warning',
      suggestion: '⚠️ 该开关可能通过变量名动态拼接引用，静态扫描无法覆盖。建议全局搜索开关名的关键词片段进行人工确认。',
    });
    level = 'high';
    suggestedAction = 'verify_first';
  }

  if (hasGray && !hasHighGray && level !== 'blocker') {
    const maxGray = Math.max(...environmentStatuses.map(e => e.grayUsers));
    reasons.push({
      code: 'GRAY_USERS_EXIST',
      message: `仍有 ${maxGray} 位灰度用户`,
      severity: 'warning',
      suggestion: `⚠️ 仍有 ${maxGray} 位灰度用户在使用此功能，建议确认这部分用户是否已迁移或可以下线。`,
    });
    if (level === 'low' || level === 'medium') level = 'high';
    suggestedAction = 'verify_first';
  }

  if (envInconsistent && level !== 'blocker') {
    reasons.push({
      code: 'ENV_INCONSISTENCY',
      message: '各环境开关状态不一致',
      severity: 'warning',
      suggestion: '⚠️ 各环境开关配置不一致，请确认是否为预期状态，避免清理后其他环境受影响。',
    });
    if (level === 'low' || level === 'medium') level = 'high';
    suggestedAction = 'verify_first';
  }

  if (codeReferences.length > 0 && codeReferences.every(r => r.matchType === 'static') && level === 'low') {
    const commentedRefs = codeReferences.filter(r => r.codeSnippet.trim().startsWith('//') || r.codeSnippet.trim().startsWith('/*'));
    if (commentedRefs.length === codeReferences.length) {
      reasons.push({
        code: 'COMMENTED_CODE_ONLY',
        message: `${codeReferences.length} 处引用均已注释`,
        severity: 'warning',
        suggestion: '该开关的代码引用均已注释，建议确认是否可以安全删除。',
      });
      level = 'medium';
      suggestedAction = 'verify_first';
    } else if (staleLaunchDate && allEnabled) {
      reasons.push({
        code: 'STALE_BUT_REFERENCED',
        message: '开关已全量长期开启但仍有代码引用',
        severity: 'warning',
        suggestion: '该开关已全量开启超过180天运行稳定，建议移除开关判断逻辑，保留默认行为。',
      });
      level = 'medium';
      suggestedAction = 'verify_first';
    } else {
      reasons.push({
        code: 'ACTIVE_REFERENCES',
        message: `存在 ${codeReferences.length} 处有效代码引用`,
        severity: 'warning',
        suggestion: '该开关仍有有效代码引用，请确认这些逻辑是否可以移除。',
      });
      level = 'medium';
      suggestedAction = 'verify_first';
    }
  }

  if (level === 'low' && staleLaunchDate && allEnabled && codeReferences.length === 0) {
    reasons.push({
      code: 'SAFE_TO_DELETE',
      message: '代码无引用、全量开启超过阈值、无灰度用户',
      severity: 'warning',
      suggestion: '该开关已满足所有安全删除条件，可直接清理。',
    });
  }

  if (level === 'low' && codeReferences.length === 0 && !staleLaunchDate) {
    reasons.push({
      code: 'RECENT_LAUNCH',
      message: '上线时间不足阈值',
      severity: 'warning',
      suggestion: '该开关上线时间较短，建议观察更久后再考虑清理。',
    });
    level = 'medium';
    suggestedAction = 'verify_first';
  }

  return {
    id: `assessment-${flag.id}`,
    flagId: flag.id,
    level,
    reasons,
    suggestedAction,
    assessedAt: new Date().toISOString(),
  };
}

export function getRiskLevelLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    blocker: '阻塞',
  };
  return labels[level];
}

export function getSuggestedActionLabel(action: SuggestedAction): string {
  const labels: Record<SuggestedAction, string> = {
    safe_delete: '可安全删除',
    verify_first: '建议人工确认',
    do_not_delete: '禁止清理',
  };
  return labels[action];
}

export function getMatchTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    static: '静态引用',
    dynamic: '动态引用',
    suspected: '疑似动态',
  };
  return labels[type] || type;
}
