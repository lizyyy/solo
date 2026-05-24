'use strict'

const fs = require('fs').promises
const path = require('path')
const { EXIT_CODES } = require('../config/constants')

class JsonOutputError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'JsonOutputError'
    this.code = code || EXIT_CODES.ERROR_OUTPUT_FAILED
  }
}

async function writeJsonReport (result, outputDir, fileName = 'permission-diff.json') {
  try {
    await fs.mkdir(outputDir, { recursive: true })

    const jsonData = buildJsonReport(result)
    const filePath = path.join(outputDir, fileName)

    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf-8')

    return {
      path: filePath,
      fileName,
      size: Buffer.byteLength(JSON.stringify(jsonData), 'utf-8')
    }
  } catch (err) {
    throw new JsonOutputError(`写入 JSON 报告失败: ${err.message}`)
  }
}

function buildJsonReport (result) {
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      tool: 'android-permission-diff',
      version: require('../../package.json').version
    },
    versions: {
      old: extractVersionInfo(result.oldVersion),
      new: extractVersionInfo(result.newVersion)
    },
    permissions: {
      summary: result.permissions ? result.permissions.summary : null,
      added: result.permissions ? simplifyPermissions(result.permissions.added) : [],
      removed: result.permissions ? simplifyPermissions(result.permissions.removed) : [],
      changed: result.permissions ? simplifyChangedPermissions(result.permissions.changed) : [],
      unchanged: result.permissions ? simplifyPermissions(result.permissions.unchanged) : []
    },
    features: {
      summary: result.features ? result.features.summary : null,
      added: result.features ? simplifyFeatures(result.features.added) : [],
      removed: result.features ? simplifyFeatures(result.features.removed) : [],
      changed: result.features ? simplifyChangedFeatures(result.features.changed) : []
    },
    groups: result.groups ? result.groups.groups : [],
    risk: result.risk ? simplifyRiskReport(result.risk) : null,
    sources: result.sources ? simplifySources(result.sources) : null,
    obfuscated: result.obfuscated ? simplifyObfuscated(result.obfuscated) : null,
    exitCode: result.exitCode || 0
  }

  return report
}

function extractVersionInfo (version) {
  if (!version) return null

  return {
    source: version.source,
    sourceType: version.sourceType,
    fileName: version.fileName,
    appInfo: version.appInfo,
    sdkInfo: version.sdkInfo
  }
}

function simplifyPermissions (permissions) {
  return permissions.map(item => {
    const perm = item.permission || item
    return {
      name: perm.name,
      type: perm.type || null,
      maxSdkVersion: perm.maxSdkVersion || null,
      sdk23: perm.sdk23 || false,
      group: item.group ? item.group.name : null,
      risk: item.risk ? {
        level: item.risk.level,
        name: item.risk.name,
        key: item.risk.key
      } : null,
      obfuscated: item.obfuscated || false,
      sources: item.sources ? item.sources.map(s => ({
        type: s.type,
        name: s.name,
        direct: s.direct,
        viaFeature: s.viaFeature || null
      })) : [],
      sourceType: item.sourceType || 'unknown',
      confidence: item.confidence || 0
    }
  })
}

function simplifyChangedPermissions (changed) {
  return changed.map(item => ({
    name: item.permission.name,
    group: item.group ? item.group.name : null,
    risk: item.risk ? {
      level: item.risk.level,
      name: item.risk.name,
      key: item.risk.key
    } : null,
    changes: item.changes.map(c => ({
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue
    })),
    sources: item.sources ? item.sources.map(s => ({
      type: s.type,
      name: s.name
    })) : [],
    sourceType: item.sourceType || 'unknown',
    confidence: item.confidence || 0
  }))
}

function simplifyFeatures (features) {
  return features.map(item => {
    const feat = item.feature || item
    return {
      name: feat.name,
      required: feat.required !== false,
      glEsVersion: feat.glEsVersion || null,
      type: feat.type || 'feature',
      impliedPermissions: item.impliedPermissions || []
    }
  })
}

function simplifyChangedFeatures (changed) {
  return changed.map(item => ({
    name: item.feature.name,
    changes: item.changes.map(c => ({
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue
    })),
    impliedPermissions: item.impliedPermissions || []
  }))
}

function simplifyRiskReport (risk) {
  return {
    overall: risk.overall,
    critical: {
      addedCount: risk.critical.addedCount,
      removedCount: risk.critical.removedCount,
      added: risk.critical.added.map(i => i.permission.name),
      removed: risk.critical.removed.map(i => i.permission.name)
    },
    high: {
      addedCount: risk.high.addedCount,
      removedCount: risk.high.removedCount,
      added: risk.high.added.map(i => i.permission.name),
      removed: risk.high.removed.map(i => i.permission.name)
    },
    medium: {
      addedCount: risk.medium.addedCount,
      removedCount: risk.medium.removedCount,
      added: risk.medium.added.map(i => i.permission.name),
      removed: risk.medium.removed.map(i => i.permission.name)
    },
    low: {
      addedCount: risk.low.addedCount,
      removedCount: risk.low.removedCount,
      added: risk.low.added.map(i => i.permission.name),
      removed: risk.low.removed.map(i => i.permission.name)
    },
    unknown: {
      addedCount: risk.unknown.addedCount,
      removedCount: risk.unknown.removedCount,
      added: risk.unknown.added.map(i => i.permission.name),
      removed: risk.unknown.removed.map(i => i.permission.name)
    },
    recommendations: risk.recommendations || []
  }
}

function simplifySources (sources) {
  return {
    summary: sources.summary || null,
    injected: sources.injected ? {
      count: sources.injected.count,
      likelyFromLibraries: sources.injected.likelyFromLibraries,
      permissions: sources.injected.injected.map(i => ({
        permission: i.permission,
        likelyFromLibrary: i.likelyFromLibrary
      }))
    } : null
  }
}

function simplifyObfuscated (obfuscated) {
  return {
    hasObfuscated: obfuscated.hasObfuscated,
    added: obfuscated.added.map(p => p.permission ? p.permission.name : p.name),
    removed: obfuscated.removed.map(p => p.permission ? p.permission.name : p.name)
  }
}

module.exports = {
  writeJsonReport,
  buildJsonReport,
  JsonOutputError
}
