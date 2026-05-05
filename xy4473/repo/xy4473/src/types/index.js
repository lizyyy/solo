export const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const ActionType = {
  RETEST: 'retest',
  RESTRICT: 'restrict',
  IMMEDIATE: 'immediate',
  NORMAL: 'normal',
};

export const RiskLevelLabels = {
  [RiskLevel.LOW]: '低风险',
  [RiskLevel.MEDIUM]: '中风险',
  [RiskLevel.HIGH]: '高风险',
  [RiskLevel.CRITICAL]: '严重风险',
};

export const ActionTypeLabels = {
  [ActionType.RETEST]: '需要复测',
  [ActionType.RESTRICT]: '需要限行',
  [ActionType.IMMEDIATE]: '立即派单',
  [ActionType.NORMAL]: '正常',
};

export const RiskLevelColors = {
  [RiskLevel.LOW]: '#52c41a',
  [RiskLevel.MEDIUM]: '#faad14',
  [RiskLevel.HIGH]: '#fa8c16',
  [RiskLevel.CRITICAL]: '#ff4d4f',
};

export const ActionTypeColors = {
  [ActionType.RETEST]: '#1890ff',
  [ActionType.RESTRICT]: '#fa8c16',
  [ActionType.IMMEDIATE]: '#ff4d4f',
  [ActionType.NORMAL]: '#52c41a',
};
