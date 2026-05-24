'use strict'

const {
  PERMISSION_GROUPS,
  FEATURE_PERMISSION_MAP,
  EXIT_CODES
} = require('../config/constants')

const {
  getPermissionGroup,
  isLikelyObfuscated
} = require('../parser')

class DiffEngineError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'DiffEngineError'
    this.code = code || EXIT_CODES.ERROR_COMPARE_FAILED
  }
}

function comparePermissions (oldData, newData) {
  if (!oldData || !newData) {
    throw new DiffEngineError('缺少对比数据')
  }

  const oldPerms = new Map(oldData.permissions.map(p => [p.name, p]))
  const newPerms = new Map(newData.permissions.map(p => [p.name, p]))

  const added = []
  const removed = []
  const changed = []
  const unchanged = []

  for (const [name, newPerm] of newPerms) {
    if (!oldPerms.has(name)) {
      added.push({
        permission: newPerm,
        group: getPermissionGroup(name),
        obfuscated: isLikelyObfuscated(name)
      })
    } else {
      const oldPerm = oldPerms.get(name)
      const changes = detectPermissionChanges(oldPerm, newPerm)
      if (changes.length > 0) {
        changed.push({
          permission: newPerm,
          oldPermission: oldPerm,
          changes,
          group: getPermissionGroup(name)
        })
      } else {
        unchanged.push({
          permission: newPerm,
          group: getPermissionGroup(name)
        })
      }
    }
  }

  for (const [name, oldPerm] of oldPerms) {
    if (!newPerms.has(name)) {
      removed.push({
        permission: oldPerm,
        group: getPermissionGroup(name),
        obfuscated: isLikelyObfuscated(name)
      })
    }
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    summary: {
      totalOld: oldPerms.size,
      totalNew: newPerms.size,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      unchangedCount: unchanged.length
    }
  }
}

function detectPermissionChanges (oldPerm, newPerm) {
  const changes = []

  if (oldPerm.type !== newPerm.type) {
    changes.push({
      field: 'type',
      oldValue: oldPerm.type,
      newValue: newPerm.type
    })
  }

  if (oldPerm.maxSdkVersion !== newPerm.maxSdkVersion) {
    changes.push({
      field: 'maxSdkVersion',
      oldValue: oldPerm.maxSdkVersion,
      newValue: newPerm.maxSdkVersion
    })
  }

  if (oldPerm.sdk23 !== newPerm.sdk23) {
    changes.push({
      field: 'sdk23',
      oldValue: oldPerm.sdk23,
      newValue: newPerm.sdk23
    })
  }

  if (oldPerm.protectionLevel !== newPerm.protectionLevel) {
    changes.push({
      field: 'protectionLevel',
      oldValue: oldPerm.protectionLevel,
      newValue: newPerm.protectionLevel
    })
  }

  return changes
}

function compareFeatures (oldData, newData) {
  const oldFeatures = new Map(oldData.features.map(f => [f.name, f]))
  const newFeatures = new Map(newData.features.map(f => [f.name, f]))

  const added = []
  const removed = []
  const changed = []
  const unchanged = []

  for (const [name, newFeature] of newFeatures) {
    if (!oldFeatures.has(name)) {
      added.push({
        feature: newFeature,
        impliedPermissions: FEATURE_PERMISSION_MAP[name] || []
      })
    } else {
      const oldFeature = oldFeatures.get(name)
      const changes = detectFeatureChanges(oldFeature, newFeature)
      if (changes.length > 0) {
        changed.push({
          feature: newFeature,
          oldFeature,
          changes,
          impliedPermissions: FEATURE_PERMISSION_MAP[name] || []
        })
      } else {
        unchanged.push({
          feature: newFeature,
          impliedPermissions: FEATURE_PERMISSION_MAP[name] || []
        })
      }
    }
  }

  for (const [name, oldFeature] of oldFeatures) {
    if (!newFeatures.has(name)) {
      removed.push({
        feature: oldFeature,
        impliedPermissions: FEATURE_PERMISSION_MAP[name] || []
      })
    }
  }

  return {
    added,
    removed,
    changed,
    unchanged,
    summary: {
      totalOld: oldFeatures.size,
      totalNew: newFeatures.size,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length
    }
  }
}

function detectFeatureChanges (oldFeature, newFeature) {
  const changes = []

  if (oldFeature.required !== newFeature.required) {
    changes.push({
      field: 'required',
      oldValue: oldFeature.required,
      newValue: newFeature.required
    })
  }

  if (oldFeature.glEsVersion !== newFeature.glEsVersion) {
    changes.push({
      field: 'glEsVersion',
      oldValue: oldFeature.glEsVersion,
      newValue: newFeature.glEsVersion
    })
  }

  return changes
}

function comparePermissionGroups (oldData, newData) {
  const oldGroups = getGroupedPermissions(oldData.permissions)
  const newGroups = getGroupedPermissions(newData.permissions)

  const groupChanges = []

  for (const [groupId, newGroup] of newGroups) {
    const oldGroup = oldGroups.get(groupId) || { permissions: [] }
    const oldPerms = new Set(oldGroup.permissions.map(p => p.name))
    const newPerms = new Set(newGroup.permissions.map(p => p.name))

    const added = [...newPerms].filter(p => !oldPerms.has(p))
    const removed = [...oldPerms].filter(p => !newPerms.has(p))

    if (added.length > 0 || removed.length > 0) {
      groupChanges.push({
        groupId,
        groupName: PERMISSION_GROUPS[groupId]?.name || groupId,
        added,
        removed,
        totalNew: newPerms.size,
        totalOld: oldPerms.size
      })
    }
  }

  for (const [groupId, oldGroup] of oldGroups) {
    if (!newGroups.has(groupId)) {
      groupChanges.push({
        groupId,
        groupName: PERMISSION_GROUPS[groupId]?.name || groupId,
        added: [],
        removed: oldGroup.permissions.map(p => p.name),
        totalNew: 0,
        totalOld: oldGroup.permissions.length
      })
    }
  }

  return {
    groups: groupChanges,
    summary: {
      totalGroups: groupChanges.length
    }
  }
}

function getGroupedPermissions (permissions) {
  const groups = new Map()

  for (const perm of permissions) {
    const group = getPermissionGroup(perm.name)
    if (group) {
      if (!groups.has(group.id)) {
        groups.set(group.id, { permissions: [] })
      }
      groups.get(group.id).permissions.push(perm)
    }
  }

  return groups
}

function detectObfuscated (diffResult) {
  const obfuscatedAdded = diffResult.added.filter(p => p.obfuscated)
  const obfuscatedRemoved = diffResult.removed.filter(p => p.obfuscated)

  return {
    added: obfuscatedAdded,
    removed: obfuscatedRemoved,
    hasObfuscated: obfuscatedAdded.length > 0 || obfuscatedRemoved.length > 0
  }
}

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
