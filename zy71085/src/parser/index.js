'use strict'

const {
  parseApk,
  parseManifestFile,
  parseModuleManifest,
  parseModulesDirectory,
  parseManifestBuffer,
  extractAppInfo,
  extractPermissions,
  extractFeatures,
  extractSdkInfo,
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

const {
  parseBinaryXml,
  isBinaryXml,
  AxmlParser,
  AxmlParserError
} = require('./axml-parser')

module.exports = {
  parseApk,
  parseManifestFile,
  parseModuleManifest,
  parseModulesDirectory,
  parseManifestBuffer,
  extractAppInfo,
  extractPermissions,
  extractFeatures,
  extractSdkInfo,
  parseXml,
  parseBinaryXml,
  isBinaryXml,
  normalizePermissionName,
  getPermissionGroup,
  parseProtectionLevel,
  extractObfuscatedNames,
  isLikelyObfuscated,
  AxmlParser,
  ApkParserError,
  AxmlParserError
}
