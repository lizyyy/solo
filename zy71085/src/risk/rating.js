'use strict'

const {
  RISK_LEVELS,
  PERMISSION_RISK_MAP,
  PERMISSION_GROUPS,
  EXIT_CODES
} = require('../config/constants')

const { getPermissionGroup } = require('../parser')

class RiskRatingError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'RiskRatingError'
    this.code = code || EXIT_CODES.ERROR_COMPARE_FAILED
  }
}

function getPermissionRiskLevel (permName) {
  const riskKey = PERMISSION_RISK_MAP[permName]

  if (riskKey && RISK_LEVELS[riskKey]) {
    return {
      level: RISK_LEVELS[riskKey].level,
      name: RISK_LEVELS[riskKey].name,
      key: riskKey,
      color: RISK_LEVELS[riskKey].color,
      description: RISK_LEVELS[riskKey].description,
      known: true
    }
  }

  return {
    level: RISK_LEVELS.UNKNOWN.level,
    name: RISK_LEVELS.UNKNOWN.name,
    key: 'UNKNOWN',
    color: RISK_LEVELS.UNKNOWN.color,
    description: RISK_LEVELS.UNKNOWN.description,
    known: false
  }
}

function rateDiffPermissions (diffResult) {
  const addedWithRisk = []
  const removedWithRisk = []
  const changedWithRisk = []
  const unchangedWithRisk = []

  for (const item of diffResult.added) {
    const risk = getPermissionRiskLevel(item.permission.name)
    addedWithRisk.push({
      ...item,
      risk
    })
  }

  for (const item of diffResult.removed) {
    const risk = getPermissionRiskLevel(item.permission.name)
    removedWithRisk.push({
      ...item,
      risk
    })
  }

  for (const item of diffResult.changed) {
    const risk = getPermissionRiskLevel(item.permission.name)
    changedWithRisk.push({
      ...item,
      risk
    })
  }

  for (const item of diffResult.unchanged) {
    const risk = getPermissionRiskLevel(item.permission.name)
    unchangedWithRisk.push({
      ...item,
      risk
    })
  }

  const riskSummary = calculateRiskSummary(addedWithRisk, removedWithRisk)

  return {
    added: addedWithRisk,
    removed: removedWithRisk,
    changed: changedWithRisk,
    unchanged: unchangedWithRisk,
    summary: {
      ...diffResult.summary,
      risk: riskSummary
    }
  }
}

function calculateRiskSummary (added, removed) {
  const summary = {
    addedByLevel: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNKNOWN: 0
    },
    removedByLevel: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNKNOWN: 0
    },
    highestAddedRisk: null,
    hasCriticalAdded: false,
    hasHighAdded: false
  }

  let highestLevel = 5

  for (const item of added) {
    const riskKey = item.risk.key
    summary.addedByLevel[riskKey]++

    if (item.risk.level < highestLevel) {
      highestLevel = item.risk.level
      summary.highestAddedRisk = item.risk
    }
  }

  for (const item of removed) {
    const riskKey = item.risk.key
    summary.removedByLevel[riskKey]++
  }

  summary.hasCriticalAdded = summary.addedByLevel.CRITICAL > 0
  summary.hasHighAdded = summary.addedByLevel.HIGH > 0 || summary.hasCriticalAdded

  return summary
}

function rateAllPermissions (permissions) {
  return permissions.map(perm => {
    const risk = getPermissionRiskLevel(perm.name)
    const group = getPermissionGroup(perm.name)

    return {
      permission: perm,
      risk,
      group
    }
  })
}

function getGroupRiskAssessment (groupId) {
  const group = PERMISSION_GROUPS[groupId]
  if (!group) {
    return null
  }

  let highestRisk = null
  let highestLevel = 5

  for (const permName of group.permissions) {
    const risk = getPermissionRiskLevel(permName)
    if (risk.level < highestLevel) {
      highestLevel = risk.level
      highestRisk = risk
    }
  }

  return {
    groupId,
    groupName: group.name,
    highestRisk,
    permissions: group.permissions.map(name => ({
      name,
      risk: getPermissionRiskLevel(name)
    }))
  }
}

function generateRiskReport (ratedDiff) {
  const risk = ratedDiff.summary.risk || {
    addedByLevel: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    removedByLevel: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    hasHighAdded: false,
    highestAddedRisk: null
  }

  const report = {
    overall: {
      hasHighRiskChanges: risk.hasHighAdded || false,
      highestAddedRisk: risk.highestAddedRisk || null,
      needsReview: (risk.hasHighAdded || false) || (risk.addedByLevel.UNKNOWN || 0) > 0
    },
    critical: {
      added: ratedDiff.added.filter(i => i.risk.key === 'CRITICAL'),
      removed: ratedDiff.removed.filter(i => i.risk.key === 'CRITICAL'),
      addedCount: risk.addedByLevel.CRITICAL || 0,
      removedCount: risk.removedByLevel.CRITICAL || 0
    },
    high: {
      added: ratedDiff.added.filter(i => i.risk.key === 'HIGH'),
      removed: ratedDiff.removed.filter(i => i.risk.key === 'HIGH'),
      addedCount: risk.addedByLevel.HIGH || 0,
      removedCount: risk.removedByLevel.HIGH || 0
    },
    medium: {
      added: ratedDiff.added.filter(i => i.risk.key === 'MEDIUM'),
      removed: ratedDiff.removed.filter(i => i.risk.key === 'MEDIUM'),
      addedCount: risk.addedByLevel.MEDIUM || 0,
      removedCount: risk.removedByLevel.MEDIUM || 0
    },
    low: {
      added: ratedDiff.added.filter(i => i.risk.key === 'LOW'),
      removed: ratedDiff.removed.filter(i => i.risk.key === 'LOW'),
      addedCount: risk.addedByLevel.LOW || 0,
      removedCount: risk.removedByLevel.LOW || 0
    },
    unknown: {
      added: ratedDiff.added.filter(i => i.risk.key === 'UNKNOWN'),
      removed: ratedDiff.removed.filter(i => i.risk.key === 'UNKNOWN'),
      addedCount: risk.addedByLevel.UNKNOWN || 0,
      removedCount: risk.removedByLevel.UNKNOWN || 0
    }
  }

  report.recommendations = generateRecommendations(report)

  return report
}

function generateRecommendations (riskReport) {
  const recommendations = []

  if (riskReport.critical.addedCount > 0) {
    recommendations.push({
      priority: 'critical',
      title: '严重权限新增',
      description: `新增了 ${riskReport.critical.addedCount} 个严重权限，需要立即审查这些权限的使用目的和必要性`,
      permissions: riskReport.critical.added.map(i => i.permission.name)
    })
  }

  if (riskReport.high.addedCount > 0) {
    recommendations.push({
      priority: 'high',
      title: '高风险权限新增',
      description: `新增了 ${riskReport.high.addedCount} 个高风险权限，建议审查并确认必要性`,
      permissions: riskReport.high.added.map(i => i.permission.name)
    })
  }

  if (riskReport.unknown.addedCount > 0) {
    recommendations.push({
      priority: 'medium',
      title: '未知权限新增',
      description: `新增了 ${riskReport.unknown.addedCount} 个未知权限，需要人工确认其来源和用途`,
      permissions: riskReport.unknown.added.map(i => i.permission.name)
    })
  }

  if (riskReport.critical.removedCount > 0) {
    recommendations.push({
      priority: 'low',
      title: '严重权限移除',
      description: `移除了 ${riskReport.critical.removedCount} 个严重权限，这是安全改进`,
      permissions: riskReport.critical.removed.map(i => i.permission.name)
    })
  }

  return recommendations
}

module.exports = {
  getPermissionRiskLevel,
  rateDiffPermissions,
  rateAllPermissions,
  getGroupRiskAssessment,
  generateRiskReport,
  calculateRiskSummary,
  generateRecommendations,
  RiskRatingError
}
