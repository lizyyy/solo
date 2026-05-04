const fs = require('fs')
const path = require('path')

const LicenseRiskAssessor = require('./LicenseRiskAssessor')
const NpmDependencyParser = require('../parsers/NpmDependencyParser')
const PythonDependencyParser = require('../parsers/PythonDependencyParser')
const ThirdPartyCsvParser = require('../parsers/ThirdPartyCsvParser')
const LicenseNoticeParser = require('../parsers/LicenseNoticeParser')
const OverridesParser = require('../parsers/OverridesParser')

class ScanEngine {
  constructor(projectDir, options = {}) {
    this.projectDir = projectDir
    this.options = {
      includeDevDependencies: options.includeDevDependencies ?? true,
      includeTransitive: options.includeTransitive ?? true,
      strict: options.strict ?? false,
      ...options
    }

    this.riskAssessor = new LicenseRiskAssessor()
    this.overridesParser = new OverridesParser(projectDir)
  }

  scan() {
    const scanResult = {
      timestamp: new Date().toISOString(),
      projectDir: this.projectDir,
      projectInfo: null,
      dependencies: [],
      licenseFiles: [],
      noticeFile: null,
      overrides: null,
      errors: [],
      warnings: [],
      statistics: {
        totalDependencies: 0,
        byRiskLevel: {
          SAFE: 0,
          LOW: 0,
          MEDIUM: 0,
          HIGH: 0,
          UNKNOWN: 0
        },
        byLicense: {},
        bySource: {}
      }
    }

    if (!fs.existsSync(this.projectDir)) {
      scanResult.errors.push({
        message: `项目目录不存在: ${this.projectDir}`,
        severity: 'error',
        category: 'input'
      })
      return scanResult
    }

    if (!fs.statSync(this.projectDir).isDirectory()) {
      scanResult.errors.push({
        message: `指定的路径不是目录: ${this.projectDir}`,
        severity: 'error',
        category: 'input'
      })
      return scanResult
    }

    this.collectProjectInfo(scanResult)

    const overridesResult = this.overridesParser.parse()
    scanResult.overrides = overridesResult.overrides
    scanResult.errors.push(...overridesResult.errors.map(e => ({ ...e, category: 'overrides' })))
    scanResult.warnings.push(...overridesResult.warnings.map(w => ({ ...w, category: 'overrides' })))

    const npmParser = new NpmDependencyParser(this.projectDir)
    const npmResult = npmParser.parse()
    this.processParserResult(scanResult, npmResult, 'npm')

    const pythonParser = new PythonDependencyParser(this.projectDir)
    const pythonResult = pythonParser.parse()
    this.processParserResult(scanResult, pythonResult, 'python')

    const csvParser = new ThirdPartyCsvParser(this.projectDir)
    const csvResult = csvParser.parse()
    this.processParserResult(scanResult, csvResult, 'third-party')

    const licenseNoticeParser = new LicenseNoticeParser(this.projectDir)
    const licenseNoticeResult = licenseNoticeParser.parse()
    this.processLicenseNoticeResult(scanResult, licenseNoticeResult)

    this.applyOverrides(scanResult)
    this.assessRisks(scanResult)
    this.deduplicateDependencies(scanResult)
    this.updateStatistics(scanResult)
    this.enrichDependencyInfo(scanResult)

    return scanResult
  }

  collectProjectInfo(scanResult) {
    scanResult.projectInfo = {
      hasPackageJson: false,
      hasRequirements: false,
      hasThirdPartyCsv: false,
      hasLicenseFile: false,
      hasNoticeFile: false,
      hasOverridesJson: false
    }

    const packageJsonPath = path.join(this.projectDir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      scanResult.projectInfo.hasPackageJson = true
      try {
        const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        scanResult.projectInfo.name = pkgJson.name
        scanResult.projectInfo.version = pkgJson.version
        scanResult.projectInfo.license = pkgJson.license
        scanResult.projectInfo.description = pkgJson.description
      } catch (error) {
        scanResult.warnings.push({
          message: '读取 package.json 失败',
          error: error.message,
          category: 'project-info'
        })
      }
    }

    const requirementsPath = path.join(this.projectDir, 'requirements.txt')
    scanResult.projectInfo.hasRequirements = fs.existsSync(requirementsPath)

    const csvPath = path.join(this.projectDir, 'third_party.csv')
    scanResult.projectInfo.hasThirdPartyCsv = fs.existsSync(csvPath)

    scanResult.projectInfo.hasLicenseFile = LicenseNoticeParser.hasProjectLicense(this.projectDir)
    scanResult.projectInfo.hasNoticeFile = LicenseNoticeParser.hasNoticeFile(this.projectDir)
    scanResult.projectInfo.hasOverridesJson = OverridesParser.hasOverridesFile(this.projectDir)
  }

  processParserResult(scanResult, parserResult, sourceType) {
    scanResult.errors.push(...parserResult.errors.map(e => ({ 
      ...e, 
      category: 'parser',
      source: sourceType
    })))
    scanResult.warnings.push(...parserResult.warnings.map(w => ({ 
      ...w, 
      category: 'parser',
      source: sourceType
    })))

    if (parserResult.dependencies) {
      for (const dep of parserResult.dependencies) {
        if (!this.shouldIncludeDependency(dep)) {
          continue
        }

        scanResult.dependencies.push({
          ...dep,
          sourceType: sourceType,
          riskLevel: null,
          riskInfo: null,
          licenseInfo: null,
          issues: [],
          overridden: false
        })
      }
    }
  }

  processLicenseNoticeResult(scanResult, licenseNoticeResult) {
    scanResult.errors.push(...licenseNoticeResult.errors.map(e => ({ 
      ...e, 
      category: 'license-notice'
    })))
    scanResult.warnings.push(...licenseNoticeResult.warnings.map(w => ({ 
      ...w, 
      category: 'license-notice'
    })))

    if (licenseNoticeResult.projectLicense) {
      scanResult.licenseFiles.push(licenseNoticeResult.projectLicense)
    }

    if (licenseNoticeResult.noticeFile) {
      scanResult.noticeFile = licenseNoticeResult.noticeFile
    }

    if (licenseNoticeResult.licenseFiles) {
      scanResult.licenseFiles.push(...licenseNoticeResult.licenseFiles)
    }
  }

  shouldIncludeDependency(dep) {
    if (!this.options.includeDevDependencies && 
        (dep.type === 'development' || dep.type === 'dev' || dep.type === 'transitive-dev')) {
      return false
    }

    if (!this.options.includeTransitive && 
        (dep.type === 'transitive' || dep.type === 'transitive-dev')) {
      return false
    }

    if (this.overridesParser.isPackageIgnored(dep.name)) {
      return false
    }

    if (this.overridesParser.isPackageExcluded(dep.name, dep.type)) {
      return false
    }

    return true
  }

  applyOverrides(scanResult) {
    if (!scanResult.overrides) {
      return
    }

    for (const dep of scanResult.dependencies) {
      const licenseOverride = this.overridesParser.getLicenseOverride(dep.name, dep.version)
      if (licenseOverride) {
        dep.originalLicense = dep.license
        dep.license = licenseOverride.license
        dep.licenseSource = licenseOverride.source
        dep.overridden = true
        dep.overrideNotes = licenseOverride.notes
        
        if (!dep.issues) dep.issues = []
        dep.issues.push({
          type: 'override',
          message: `许可证已覆盖: ${dep.originalLicense || '未知'} -> ${dep.license}`,
          source: licenseOverride.source
        })
      }

      const riskOverride = this.overridesParser.getRiskOverride(dep.license)
      if (riskOverride) {
        dep.riskOverride = riskOverride
      }
    }
  }

  assessRisks(scanResult) {
    for (const dep of scanResult.dependencies) {
      const license = dep.license || 'UNKNOWN'
      
      const riskLevel = dep.riskOverride 
        ? this.getRiskLevelFromOverride(dep.riskOverride)
        : this.riskAssessor.assessRisk(license)
      
      dep.riskLevel = riskLevel.level
      dep.riskInfo = riskLevel
      
      const licenseExplanation = this.riskAssessor.getLicenseExplanation(license)
      dep.licenseInfo = licenseExplanation
      
      dep.normalizedLicense = this.riskAssessor.normalizeLicense(license)
      
      dep.isCopyleft = this.riskAssessor.isCopyleft(license)
      dep.isNetworkServiceRisk = this.riskAssessor.isNetworkServiceRisk(license)
      dep.requiresNotice = this.riskAssessor.requiresNotice(license)
      dep.requiresAttribution = this.riskAssessor.requiresAttribution(license)
    }
  }

  getRiskLevelFromOverride(override) {
    const riskLevels = {
      SAFE: {
        level: 'SAFE',
        color: 'green',
        displayName: '安全',
        description: '已覆盖为安全等级'
      },
      LOW: {
        level: 'LOW',
        color: 'yellow',
        displayName: '低风险',
        description: '已覆盖为低风险'
      },
      MEDIUM: {
        level: 'MEDIUM',
        color: 'orange',
        displayName: '中风险',
        description: '已覆盖为中风险'
      },
      HIGH: {
        level: 'HIGH',
        color: 'red',
        displayName: '高风险',
        description: '已覆盖为高风险'
      },
      UNKNOWN: {
        level: 'UNKNOWN',
        color: 'gray',
        displayName: '未知',
        description: '已覆盖为未知'
      }
    }

    return riskLevels[override.toUpperCase()] || riskLevels.UNKNOWN
  }

  deduplicateDependencies(scanResult) {
    const uniqueDeps = []
    const depMap = new Map()

    for (const dep of scanResult.dependencies) {
      const key = `${dep.name}@${dep.version || 'unknown'}`
      
      if (!depMap.has(key)) {
        depMap.set(key, dep)
        uniqueDeps.push(dep)
      } else {
        const existing = depMap.get(key)
        
        if (!existing.license && dep.license) {
          existing.license = dep.license
        }
        
        if (!existing.resolvedVersion && dep.resolvedVersion) {
          existing.resolvedVersion = dep.resolvedVersion
        }
        
        if (!existing.sources) {
          existing.sources = [existing.source]
        }
        if (!existing.sources.includes(dep.source)) {
          existing.sources.push(dep.source)
        }
        
        if (!existing.issues) existing.issues = []
        existing.issues.push({
          type: 'duplicate',
          message: `在多个源中发现: ${existing.source} 和 ${dep.source}`,
          sources: [existing.source, dep.source]
        })
      }
    }

    scanResult.dependencies = uniqueDeps
  }

  updateStatistics(scanResult) {
    const stats = scanResult.statistics
    stats.totalDependencies = scanResult.dependencies.length

    for (const dep of scanResult.dependencies) {
      const riskLevel = dep.riskLevel || 'UNKNOWN'
      stats.byRiskLevel[riskLevel] = (stats.byRiskLevel[riskLevel] || 0) + 1

      const license = dep.normalizedLicense || dep.license || 'UNKNOWN'
      stats.byLicense[license] = (stats.byLicense[license] || 0) + 1

      const source = dep.sourceType || dep.source || 'unknown'
      stats.bySource[source] = (stats.bySource[source] || 0) + 1
    }
  }

  enrichDependencyInfo(scanResult) {
    for (const dep of scanResult.dependencies) {
      if (!dep.issues) dep.issues = []

      if (dep.license === null || dep.license === 'UNKNOWN' || !dep.license) {
        dep.issues.push({
          type: 'missing-license',
          severity: 'high',
          message: '未找到许可证信息',
          evidence: dep.source
        })
      }

      if (dep.version === '*' || dep.version === null || dep.version === undefined) {
        dep.issues.push({
          type: 'missing-version',
          severity: 'medium',
          message: '版本信息不明确',
          evidence: dep.source
        })
      }

      if (dep.isCopyleft) {
        dep.issues.push({
          type: 'copyleft',
          severity: dep.isNetworkServiceRisk ? 'high' : 'medium',
          message: dep.isNetworkServiceRisk 
            ? 'AGPL 许可证 - 网络服务场景也需开源' 
            : 'Copyleft 许可证 - 可能需要公开源码',
          license: dep.license,
          evidence: dep.source
        })
      }

      if (dep.requiresNotice && scanResult.noticeFile === null) {
        dep.issues.push({
          type: 'missing-notice',
          severity: 'medium',
          message: 'Apache-2.0 许可证需要 NOTICE 文件',
          license: dep.license,
          evidence: dep.source
        })
      }
    }
  }

  static validateProjectDir(projectDir) {
    if (!fs.existsSync(projectDir)) {
      return {
        valid: false,
        error: `项目目录不存在: ${projectDir}`
      }
    }

    if (!fs.statSync(projectDir).isDirectory()) {
      return {
        valid: false,
        error: `指定的路径不是目录: ${projectDir}`
      }
    }

    const hasPackageJson = fs.existsSync(path.join(projectDir, 'package.json'))
    const hasRequirements = fs.existsSync(path.join(projectDir, 'requirements.txt'))
    const hasThirdPartyCsv = fs.existsSync(path.join(projectDir, 'third_party.csv'))

    if (!hasPackageJson && !hasRequirements && !hasThirdPartyCsv) {
      return {
        valid: true,
        warning: '未找到 package.json、requirements.txt 或 third_party.csv，扫描结果可能为空'
      }
    }

    return { valid: true }
  }
}

module.exports = ScanEngine
