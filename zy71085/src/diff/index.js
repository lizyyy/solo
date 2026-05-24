'use strict'

const {
  comparePermissions,
  compareFeatures,
  comparePermissionGroups,
  detectPermissionChanges,
  detectFeatureChanges,
  getGroupedPermissions,
  detectObfuscated,
  DiffEngineError
} = require('./engine')

module.exports = {
  comparePermissions,
  compareFeatures,
  comparePermissionGroups,
  detectPermissionChanges,
  detectFeatureChanges,
  getGroupedPermissions,
  detectObfuscated,
  DiffEngineError
}
