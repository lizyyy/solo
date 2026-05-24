'use strict'

const { EXIT_CODES, FEATURE_PERMISSION_MAP } = require('../config/constants')

class SourceTrackerError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'SourceTrackerError'
    this.code = code || EXIT_CODES.ERROR_COMPARE_FAILED
  }
}

function trackPermissionSources (permissions, modules, knownLibraries = []) {
  const tracked = new Map()

  for (const perm of permissions) {
    const permName = typeof perm === 'string' ? perm : perm.name
    const sources = findPermissionSources(permName, modules, knownLibraries)

    tracked.set(permName, {
      permission: permName,
      sources,
      sourceType: determineSourceType(sources),
      confidence: calculateConfidence(sources)
    })
  }

  return tracked
}

function findPermissionSources (permName, modules, knownLibraries) {
  const sources = []

  for (const module of modules) {
    if (module.permissions && module.permissions.includes(permName)) {
      sources.push({
        type: 'module',
        name: module.moduleName,
        source: module.source,
        direct: true
      })
    }

    if (module.features) {
      for (const feature of module.features) {
        const impliedPerms = FEATURE_PERMISSION_MAP[feature] || []
        if (impliedPerms.includes(permName)) {
          sources.push({
            type: 'module',
            name: module.moduleName,
            source: module.source,
            direct: false,
            viaFeature: feature
          })
        }
      }
    }
  }

  for (const lib of knownLibraries) {
    if (lib.permissions && lib.permissions.includes(permName)) {
      sources.push({
        type: 'library',
        name: lib.name,
        source: lib.source || lib.name,
        direct: true
      })
    }
  }

  return sources
}

function determineSourceType (sources) {
  if (sources.length === 0) {
    return 'unknown'
  }

  const hasModule = sources.some(s => s.type === 'module')
  const hasLibrary = sources.some(s => s.type === 'library')

  if (hasModule && hasLibrary) {
    return 'mixed'
  }
  if (hasModule) {
    return 'module'
  }
  if (hasLibrary) {
    return 'library'
  }

  return 'unknown'
}

function calculateConfidence (sources) {
  if (sources.length === 0) {
    return 0
  }

  const directSources = sources.filter(s => s.direct)
  const indirectSources = sources.filter(s => !s.direct)

  let score = 0
  score += directSources.length * 0.3
  score += indirectSources.length * 0.1

  const hasModule = sources.some(s => s.type === 'module')
  if (hasModule) {
    score += 0.4
  }

  return Math.min(score, 1)
}

function analyzeDiffSources (diffResult, modules, knownLibraries) {
  const addedWithSources = []
  const removedWithSources = []
  const changedWithSources = []

  for (const item of diffResult.added) {
    const sources = findPermissionSources(item.permission.name, modules, knownLibraries)
    addedWithSources.push({
      ...item,
      sources,
      sourceType: determineSourceType(sources),
      confidence: calculateConfidence(sources)
    })
  }

  for (const item of diffResult.removed) {
    const sources = findPermissionSources(item.permission.name, modules, knownLibraries)
    removedWithSources.push({
      ...item,
      sources,
      sourceType: determineSourceType(sources),
      confidence: calculateConfidence(sources)
    })
  }

  for (const item of diffResult.changed) {
    const sources = findPermissionSources(item.permission.name, modules, knownLibraries)
    changedWithSources.push({
      ...item,
      sources,
      sourceType: determineSourceType(sources),
      confidence: calculateConfidence(sources)
    })
  }

  return {
    added: addedWithSources,
    removed: removedWithSources,
    changed: changedWithSources,
    unchanged: diffResult.unchanged,
    summary: {
      ...diffResult.summary,
      withSources: addedWithSources.filter(i => i.sources.length > 0).length,
      withoutSources: addedWithSources.filter(i => i.sources.length === 0).length
    }
  }
}

function generateSourceSummary (trackedPermissions) {
  const summary = {
    bySourceType: {
      module: 0,
      library: 0,
      mixed: 0,
      unknown: 0
    },
    byModule: new Map(),
    byLibrary: new Map(),
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0
  }

  for (const [permName, tracking] of trackedPermissions) {
    summary.bySourceType[tracking.sourceType]++

    if (tracking.confidence >= 0.7) {
      summary.highConfidence++
    } else if (tracking.confidence >= 0.4) {
      summary.mediumConfidence++
    } else {
      summary.lowConfidence++
    }

    for (const source of tracking.sources) {
      if (source.type === 'module') {
        const moduleStats = summary.byModule.get(source.name) || { count: 0, permissions: [] }
        moduleStats.count++
        moduleStats.permissions.push(permName)
        summary.byModule.set(source.name, moduleStats)
      } else if (source.type === 'library') {
        const libStats = summary.byLibrary.get(source.name) || { count: 0, permissions: [] }
        libStats.count++
        libStats.permissions.push(permName)
        summary.byLibrary.set(source.name, libStats)
      }
    }
  }

  summary.byModule = Object.fromEntries(summary.byModule)
  summary.byLibrary = Object.fromEntries(summary.byLibrary)

  return summary
}

function detectInjectedPermissions (diffResult, modules) {
  const injected = []
  const modulePermissions = new Set()

  for (const module of modules) {
    if (module.permissions) {
      for (const perm of module.permissions) {
        modulePermissions.add(perm)
      }
    }
  }

  for (const item of diffResult.added) {
    if (!modulePermissions.has(item.permission.name)) {
      const sources = item.sources || []
      const hasLibrarySource = sources.some(s => s.type === 'library')

      injected.push({
        permission: item.permission.name,
        likelyFromLibrary: hasLibrarySource,
        sources
      })
    }
  }

  return {
    injected,
    count: injected.length,
    likelyFromLibraries: injected.filter(i => i.likelyFromLibrary).length
  }
}

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
