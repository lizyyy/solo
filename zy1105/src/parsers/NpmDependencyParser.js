const fs = require('fs')
const path = require('path')

class NpmDependencyParser {
  constructor(projectDir) {
    this.projectDir = projectDir
    this.packageJson = null
    this.lockFile = null
    this.lockFileType = null // 'package-lock' 或 'pnpm-lock'
  }

  parse() {
    const results = {
      source: 'npm/pnpm',
      dependencies: [],
      errors: [],
      warnings: []
    }

    try {
      this.readPackageJson()
      if (this.packageJson) {
        results.dependencies = this.extractDependenciesFromPackageJson()
      }
    } catch (error) {
      results.errors.push({
        message: '读取 package.json 失败',
        file: this.getPackageJsonPath(),
        error: error.message
      })
    }

    try {
      this.readLockFile()
      if (this.lockFile && this.packageJson) {
        const lockDependencies = this.extractDependenciesFromLockFile()
        this.mergeDependencies(results, lockDependencies)
      }
    } catch (error) {
      results.warnings.push({
        message: `读取锁文件失败: ${error.message}`,
        file: this.getLockFilePath() || '未知'
      })
    }

    return results
  }

  readPackageJson() {
    const packageJsonPath = this.getPackageJsonPath()
    if (fs.existsSync(packageJsonPath)) {
      const content = fs.readFileSync(packageJsonPath, 'utf-8')
      this.packageJson = JSON.parse(content)
    }
  }

  getPackageJsonPath() {
    return path.join(this.projectDir, 'package.json')
  }

  readLockFile() {
    const pnpmLockPath = path.join(this.projectDir, 'pnpm-lock.yaml')
    const packageLockPath = path.join(this.projectDir, 'package-lock.json')

    if (fs.existsSync(pnpmLockPath)) {
      this.lockFileType = 'pnpm-lock'
      const content = fs.readFileSync(pnpmLockPath, 'utf-8')
      this.lockFile = this.parseYaml(content)
    } else if (fs.existsSync(packageLockPath)) {
      this.lockFileType = 'package-lock'
      const content = fs.readFileSync(packageLockPath, 'utf-8')
      this.lockFile = JSON.parse(content)
    }
  }

  getLockFilePath() {
    if (this.lockFileType === 'pnpm-lock') {
      return path.join(this.projectDir, 'pnpm-lock.yaml')
    } else if (this.lockFileType === 'package-lock') {
      return path.join(this.projectDir, 'package-lock.json')
    }
    return null
  }

  parseYaml(content) {
    const result = {}
    const lines = content.split('\n')
    let currentSection = null
    let currentKey = null
    let indentStack = [{ level: -1, obj: result }]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim() || line.trim().startsWith('#')) continue

      const indent = line.search(/\S/)
      const trimmed = line.trim()

      while (indentStack.length > 1 && indentStack[indentStack.length - 1].level >= indent) {
        indentStack.pop()
      }

      const currentObj = indentStack[indentStack.length - 1].obj

      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim()
        if (!Array.isArray(currentObj[currentKey])) {
          currentObj[currentKey] = []
        }
        currentObj[currentKey].push(value)
      } else if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':')
        const key = trimmed.substring(0, colonIndex).trim()
        const value = trimmed.substring(colonIndex + 1).trim()

        if (value === '' || value === '|' || value === '>') {
          const newObj = {}
          if (Array.isArray(currentObj)) {
            currentObj.push(newObj)
            indentStack.push({ level: indent, obj: newObj })
          } else {
            currentObj[key] = newObj
            indentStack.push({ level: indent, obj: newObj })
          }
          currentKey = key
        } else {
          const parsedValue = this.parseYamlValue(value)
          if (Array.isArray(currentObj)) {
            const item = {}
            item[key] = parsedValue
            currentObj.push(item)
          } else {
            currentObj[key] = parsedValue
          }
          currentKey = key
        }
      }
    }

    return result
  }

  parseYamlValue(value) {
    if (value === 'true') return true
    if (value === 'false') return false
    if (value === 'null') return null
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1).replace(/\\"/g, '"')
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1).replace(/''/g, "'")
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value)
    }
    return value
  }

  extractDependenciesFromPackageJson() {
    const dependencies = []
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
      ...this.packageJson.optionalDependencies,
      ...this.packageJson.peerDependencies
    }

    for (const [name, version] of Object.entries(allDeps)) {
      dependencies.push({
        name,
        version: version,
        resolvedVersion: null,
        license: this.packageJson.license || null,
        source: 'package.json',
        type: this.getDependencyType(name)
      })
    }

    return dependencies
  }

  getDependencyType(name) {
    if (this.packageJson.dependencies && this.packageJson.dependencies[name]) {
      return 'production'
    }
    if (this.packageJson.devDependencies && this.packageJson.devDependencies[name]) {
      return 'development'
    }
    if (this.packageJson.optionalDependencies && this.packageJson.optionalDependencies[name]) {
      return 'optional'
    }
    if (this.packageJson.peerDependencies && this.packageJson.peerDependencies[name]) {
      return 'peer'
    }
    return 'unknown'
  }

  extractDependenciesFromLockFile() {
    const dependencies = []

    if (this.lockFileType === 'pnpm-lock') {
      const packages = this.lockFile.packages || this.lockFile['importers'] || {}
      
      for (const [pkgKey, pkgInfo] of Object.entries(packages)) {
        if (typeof pkgInfo === 'object' && pkgInfo !== null) {
          const { name, version } = this.parsePnpmPackageKey(pkgKey)
          if (name) {
            dependencies.push({
              name,
              version: version || pkgInfo.version || pkgKey,
              resolvedVersion: pkgInfo.version || version,
              license: pkgInfo.license || null,
              source: 'pnpm-lock.yaml',
              dependencies: pkgInfo.dependencies || null,
              dev: pkgInfo.dev || false
            })
          }
        }
      }
    } else if (this.lockFileType === 'package-lock') {
      const packages = this.lockFile.packages || {}
      
      for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
        if (pkgPath === '') continue // 跳过根项目
        
        const name = this.extractPackageNameFromPath(pkgPath)
        if (name && pkgInfo) {
          dependencies.push({
            name,
            version: pkgInfo.version || this.extractVersionFromPath(pkgPath),
            resolvedVersion: pkgInfo.version,
            license: pkgInfo.license || null,
            source: 'package-lock.json',
            dependencies: pkgInfo.dependencies || null,
            dev: pkgInfo.dev || false
          })
        }
      }
    }

    return dependencies
  }

  parsePnpmPackageKey(key) {
    const match = key.match(/^\/?(@[^/]+\/[^@]+|[^@]+)@([^/]+)/)
    if (match) {
      return { name: match[1], version: match[2] }
    }
    return { name: key, version: null }
  }

  extractPackageNameFromPath(path) {
    const nodeModulesIndex = path.lastIndexOf('node_modules/')
    if (nodeModulesIndex !== -1) {
      const namePart = path.substring(nodeModulesIndex + 'node_modules/'.length)
      return namePart
    }
    return null
  }

  extractVersionFromPath(path) {
    const match = path.match(/@([^/]+)$/)
    return match ? match[1] : null
  }

  mergeDependencies(results, lockDependencies) {
    const pkgDeps = results.dependencies
    const lockMap = new Map()

    for (const dep of lockDependencies) {
      if (!lockMap.has(dep.name)) {
        lockMap.set(dep.name, [])
      }
      lockMap.get(dep.name).push(dep)
    }

    for (const pkgDep of pkgDeps) {
      const lockVersions = lockMap.get(pkgDep.name)
      if (lockVersions && lockVersions.length > 0) {
        pkgDep.resolvedVersion = lockVersions[0].resolvedVersion || lockVersions[0].version
        pkgDep.license = pkgDep.license || lockVersions[0].license
        pkgDep.lockFileInfo = lockVersions[0]
      }
    }

    for (const [name, versions] of lockMap.entries()) {
      const existsInPackageJson = pkgDeps.some(d => d.name === name)
      if (!existsInPackageJson) {
        for (const version of versions) {
          results.dependencies.push({
            name: version.name,
            version: version.version,
            resolvedVersion: version.resolvedVersion,
            license: version.license,
            source: 'lock-only',
            type: version.dev ? 'transitive-dev' : 'transitive'
          })
        }
      }
    }
  }

  checkVersionConsistency() {
    const inconsistencies = []
    
    if (!this.packageJson || !this.lockFile) {
      return inconsistencies
    }

    const pkgDeps = this.extractDependenciesFromPackageJson()
    const lockDeps = this.extractDependenciesFromLockFile()
    const lockMap = new Map()

    for (const dep of lockDeps) {
      if (!lockMap.has(dep.name)) {
        lockMap.set(dep.name, [])
      }
      lockMap.get(dep.name).push(dep)
    }

    for (const pkgDep of pkgDeps) {
      const lockVersions = lockMap.get(pkgDep.name)
      if (lockVersions && lockVersions.length > 0) {
        const pkgVersion = pkgDep.version.replace(/^[\^~]/, '')
        const lockVersion = lockVersions[0].resolvedVersion || lockVersions[0].version
        
        if (lockVersion && !this.versionSatisfies(pkgVersion, lockVersion)) {
          inconsistencies.push({
            package: pkgDep.name,
            packageJsonVersion: pkgDep.version,
            lockFileVersion: lockVersion,
            source: 'version-consistency-check'
          })
        }
      }
    }

    return inconsistencies
  }

  versionSatisfies(range, version) {
    if (!range || !version) return true
    
    const cleanRange = range.replace(/^[\^~]/, '')
    const cleanVersion = version.replace(/^[\^~]/, '')
    
    return cleanRange === cleanVersion || 
           cleanVersion.startsWith(cleanRange + '.') ||
           this.semverSatisfies(version, range)
  }

  semverSatisfies(version, range) {
    try {
      const [vMajor, vMinor, vPatch] = version.split('.').map(Number)
      const [rMajor, rMinor, rPatch] = range.replace(/^[\^~]/, '').split('.').map(Number)
      
      if (range.startsWith('^')) {
        return vMajor === rMajor && 
               (vMinor > rMinor || (vMinor === rMinor && vPatch >= rPatch))
      }
      if (range.startsWith('~')) {
        return vMajor === rMajor && vMinor === rMinor && vPatch >= rPatch
      }
      
      return vMajor === rMajor && vMinor === rMinor && vPatch >= rPatch
    } catch {
      return false
    }
  }
}

module.exports = NpmDependencyParser
