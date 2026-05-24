'use strict'

const xml2js = require('xml2js')
const { ANDROID_MANIFEST_NS } = require('../config/constants')

async function parseXml (xmlString) {
  const parser = new xml2js.Parser({
    explicitArray: true,
    normalizeTags: false,
    normalize: false,
    trim: true,
    mergeAttrs: false,
    attrkey: '$',
    charkey: '_',
    tagNameProcessors: [
      (name) => name.replace(/^android:/, '')
    ]
  })

  return new Promise((resolve, reject) => {
    parser.parseString(xmlString, (err, result) => {
      if (err) {
        reject(err)
        return
      }
      resolve(result.manifest || result)
    })
  })
}

function normalizePermissionName (name) {
  if (!name) return ''

  if (!name.includes('.')) {
    return `android.permission.${name}`
  }

  return name
}

function getPermissionGroup (permissionName) {
  const { PERMISSION_GROUPS } = require('../config/constants')

  for (const [groupId, group] of Object.entries(PERMISSION_GROUPS)) {
    if (group.permissions.includes(permissionName)) {
      return {
        id: groupId,
        name: group.name
      }
    }
  }

  return null
}

function parseProtectionLevel (level) {
  if (!level) return ['normal']

  const levels = level.split('|').map(l => l.trim())
  return levels
}

function extractObfuscatedNames (manifest) {
  const permissions = manifest['uses-permission'] || []
  const features = manifest['uses-feature'] || []

  const obfuscatedPermissions = []
  const obfuscatedFeatures = []

  for (const perm of permissions) {
    const name = perm.$ && perm.$['android:name']
    if (name && isLikelyObfuscated(name)) {
      obfuscatedPermissions.push(name)
    }
  }

  for (const feature of features) {
    const name = feature.$ && feature.$['android:name']
    if (name && isLikelyObfuscated(name)) {
      obfuscatedFeatures.push(name)
    }
  }

  return {
    permissions: obfuscatedPermissions,
    features: obfuscatedFeatures
  }
}

function isLikelyObfuscated (name) {
  if (!name) return false

  if (!name.includes('.')) return false

  const parts = name.split('.')
  const lastPart = parts[parts.length - 1]

  if (lastPart.length < 2) return true

  if (/^[a-z]$/.test(lastPart)) return true

  if (/^[A-Z][a-z0-9]{0,2}$/.test(lastPart)) return true

  if (/(.)\1{4,}/.test(lastPart)) return true

  return false
}

module.exports = {
  parseXml,
  normalizePermissionName,
  getPermissionGroup,
  parseProtectionLevel,
  extractObfuscatedNames,
  isLikelyObfuscated
}
