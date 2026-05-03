const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
}

export const RiskLevelLabels = {
  [RiskLevel.LOW]: '低风险',
  [RiskLevel.MEDIUM]: '中风险',
  [RiskLevel.HIGH]: '高风险',
  [RiskLevel.CRITICAL]: '极高风险'
}

export const RiskLevelColors = {
  [RiskLevel.LOW]: '#2ecc71',
  [RiskLevel.MEDIUM]: '#f1c40f',
  [RiskLevel.HIGH]: '#e67e22',
  [RiskLevel.CRITICAL]: '#e74c3c'
}

export const RiskLevelOrder = {
  [RiskLevel.LOW]: 1,
  [RiskLevel.MEDIUM]: 2,
  [RiskLevel.HIGH]: 3,
  [RiskLevel.CRITICAL]: 4
}

export default RiskLevel
