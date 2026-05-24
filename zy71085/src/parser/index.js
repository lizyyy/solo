'use strict'

const {
  parseApk,
  parseManifestFile,
  parseModuleManifest,
  parseModulesDirectory,
  ApkParserError
} = require('./apk-parser')

const {
  parseXml,
  normalizePermissionName,
  getPermissionGroup,
  parseProtectionLevel,
  extractObfuscatedNames,
  isLikelyObfuscated
} = require('./manifest-parser')

module.exports = {
  parseApk,
  parseManifestFile,
  parseModuleManifest,
  parseModulesDirectory,
  parseXml,
  normalizePermissionName,
  getPermissionGroup,
  parseProtectionLevel,
  extractObfuscatedNames,
  isLikelyObfuscated,
  ApkParserError
}
