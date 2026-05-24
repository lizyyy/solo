'use strict'

const fs = require('fs').promises
const path = require('path')
const JSZip = require('jszip')
const { parseXml } = require('./manifest-parser')
const { EXIT_CODES } = require('../config/constants')

class ApkParserError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'ApkParserError'
    this.code = code || EXIT_CODES.ERROR_PARSE_FAILED
  }
}

async function parseApk (apkPath) {
  try {
    const apkBuffer = await fs.readFile(apkPath)
    const zip = await JSZip.loadAsync(apkBuffer)

    const manifestFile = zip.file('AndroidManifest.xml')
    if (!manifestFile) {
      throw new ApkParserError(`APK 文件中未找到 AndroidManifest.xml: ${apkPath}`)
    }

    const manifestXml = await manifestFile.async('string')
    const manifestData = await parseXml(manifestXml)

    const appInfo = extractAppInfo(manifestData)
    const permissions = extractPermissions(manifestData)
    const features = extractFeatures(manifestData)
    const sdkInfo = extractSdkInfo(manifestData)

    return {
      source: apkPath,
      sourceType: 'apk',
      fileName: path.basename(apkPath),
      appInfo,
      sdkInfo,
      permissions,
      features,
      rawManifest: manifestData
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ApkParserError(`APK 文件不存在: ${apkPath}`, EXIT_CODES.ERROR_FILE_NOT_FOUND)
    }
    if (err instanceof ApkParserError) {
      throw err
    }
    throw new ApkParserError(`解析 APK 失败: ${apkPath} - ${err.message}`, EXIT_CODES.ERROR_PARSE_FAILED)
  }
}

async function parseManifestFile (manifestPath) {
  try {
    const manifestXml = await fs.readFile(manifestPath, 'utf-8')
    const manifestData = await parseXml(manifestXml)

    const appInfo = extractAppInfo(manifestData)
    const permissions = extractPermissions(manifestData)
    const features = extractFeatures(manifestData)
    const sdkInfo = extractSdkInfo(manifestData)

    return {
      source: manifestPath,
      sourceType: 'manifest',
      fileName: path.basename(manifestPath),
      appInfo,
      sdkInfo,
      permissions,
      features,
      rawManifest: manifestData
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ApkParserError(`Manifest 文件不存在: ${manifestPath}`, EXIT_CODES.ERROR_FILE_NOT_FOUND)
    }
    if (err instanceof ApkParserError) {
      throw err
    }
    throw new ApkParserError(`解析 Manifest 失败: ${manifestPath} - ${err.message}`, EXIT_CODES.ERROR_PARSE_FAILED)
  }
}

function extractAppInfo (manifest) {
  const manifestAttrs = manifest.$ || {}
  const packageName = manifestAttrs.package || ''
  const versionCode = manifestAttrs['android:versionCode'] || ''
  const versionName = manifestAttrs['android:versionName'] || ''

  const application = manifest.application && manifest.application[0]
  const appAttrs = application ? application.$ || {} : {}

  return {
    packageName,
    versionCode,
    versionName,
    appName: appAttrs['android:label'] || packageName,
    icon: appAttrs['android:icon'] || '',
    debuggable: appAttrs['android:debuggable'] === 'true'
  }
}

function extractPermissions (manifest) {
  const permissions = []
  const seen = new Set()

  const usesPermission = manifest['uses-permission'] || []
  const usesPermissionSdk23 = manifest['uses-permission-sdk-23'] || []
  const permission = manifest.permission || []

  for (const perm of [...usesPermission, ...usesPermissionSdk23]) {
    const attrs = perm.$ || {}
    const name = attrs['android:name'] || ''
    if (name && !seen.has(name)) {
      seen.add(name)
      permissions.push({
        name,
        type: 'uses-permission',
        maxSdkVersion: attrs['android:maxSdkVersion'] || null,
        sdk23: usesPermissionSdk23.includes(perm)
      })
    }
  }

  for (const perm of permission) {
    const attrs = perm.$ || {}
    const name = attrs['android:name'] || ''
    if (name && !seen.has(name)) {
      seen.add(name)
      permissions.push({
        name,
        type: 'declared',
        protectionLevel: attrs['android:protectionLevel'] || 'normal',
        permissionGroup: attrs['android:permissionGroup'] || null
      })
    }
  }

  return permissions
}

function extractFeatures (manifest) {
  const features = []
  const seen = new Set()

  const usesFeature = manifest['uses-feature'] || []
  const usesLibrary = manifest['uses-library'] || []

  for (const feature of usesFeature) {
    const attrs = feature.$ || {}
    const name = attrs['android:name'] || ''
    if (name && !seen.has(name)) {
      seen.add(name)
      features.push({
        name,
        required: attrs['android:required'] !== 'false',
        glEsVersion: attrs['android:glEsVersion'] || null
      })
    }
  }

  for (const lib of usesLibrary) {
    const attrs = lib.$ || {}
    const name = attrs['android:name'] || ''
    if (name && !seen.has(name)) {
      seen.add(name)
      features.push({
        name,
        required: attrs['android:required'] !== 'false',
        type: 'library'
      })
    }
  }

  return features
}

function extractSdkInfo (manifest) {
  const usesSdk = manifest['uses-sdk'] && manifest['uses-sdk'][0]
  const attrs = usesSdk ? usesSdk.$ || {} : {}

  return {
    minSdkVersion: attrs['android:minSdkVersion'] || '',
    targetSdkVersion: attrs['android:targetSdkVersion'] || '',
    maxSdkVersion: attrs['android:maxSdkVersion'] || ''
  }
}

async function parseModuleManifest (modulePath, moduleName) {
  try {
    const manifestXml = await fs.readFile(modulePath, 'utf-8')
    const manifestData = await parseXml(manifestXml)
    const permissions = extractPermissions(manifestData)
    const features = extractFeatures(manifestData)

    return {
      moduleName,
      source: modulePath,
      permissions: permissions.map(p => p.name),
      features: features.map(f => f.name)
    }
  } catch (err) {
    return {
      moduleName,
      source: modulePath,
      error: err.message,
      permissions: [],
      features: []
    }
  }
}

async function parseModulesDirectory (modulesDir) {
  const modules = []

  try {
    const files = await fs.readdir(modulesDir)
    const manifestFiles = files.filter(f =>
      f.toLowerCase().includes('manifest') && f.endsWith('.xml')
    )

    for (const file of manifestFiles) {
      const moduleName = path.basename(file, '.xml').replace(/[._-]manifest$/i, '')
      const moduleData = await parseModuleManifest(path.join(modulesDir, file), moduleName)
      modules.push(moduleData)
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }

  return modules
}

module.exports = {
  parseApk,
  parseManifestFile,
  parseModuleManifest,
  parseModulesDirectory,
  ApkParserError
}
