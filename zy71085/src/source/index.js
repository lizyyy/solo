'use strict'

const {
  trackPermissionSources,
  findPermissionSources,
  analyzeDiffSources,
  generateSourceSummary,
  detectInjectedPermissions,
  determineSourceType,
  calculateConfidence,
  SourceTrackerError
} = require('./tracker')

module.exports = {
  trackPermissionSources,
  findPermissionSources,
  analyzeDiffSources,
  generateSourceSummary,
  detectInjectedPermissions,
  determineSourceType,
  calculateConfidence,
  SourceTrackerError
}
