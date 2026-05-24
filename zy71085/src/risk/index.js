'use strict'

const {
  getPermissionRiskLevel,
  rateDiffPermissions,
  rateAllPermissions,
  getGroupRiskAssessment,
  generateRiskReport,
  calculateRiskSummary,
  generateRecommendations,
  RiskRatingError
} = require('./rating')

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
