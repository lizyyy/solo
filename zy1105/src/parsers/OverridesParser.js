const fs = require('fs')
const path = require('path')

class OverridesParser {
  constructor(projectDir) {
    this.projectDir = projectDir
    this.overridesPath = path.join(projectDir, 'overrides.json')
  }

  parse() {
    const results = {
      source: 'overrides.json',
      overrides: null,
      errors: [],
      warnings: []
    }

    if (!fs.existsSync(this.overridesPath)) {
      results.warnings.push({
        message: '未找到 overrides.json 文件，将使用默认配置',
        file: this.overridesPath
      })
      results.overrides = this.getDefaultOverrides()
      return results
    }

    try {
      const content = fs.readFileSync(this.overridesPath, 'utf-8')
      const overrides = JSON.parse(content)
      
      const validation = this.validateOverrides(overrides)
      if (!validation.valid) {
        results.errors.push({
          message: 'overrides.json 格式错误',
          file: this.overridesPath,
          issues: validation.issues
        })
        results.overrides = this.getDefaultOverrides()
        return results
      }

      results.overrides = this.mergeWithDefaults(overrides)

    } catch (error) {
      if (error instanceof SyntaxError) {
        results.errors.push({
          message: 'overrides.json JSON 解析失败',
          file: this.overridesPath,
          error: error.message
        })
      } else {
        results.errors.push({
          message: '读取 overrides.json 失败',
          file: this.overridesPath,
          error: error.message
        })
      }
      results.overrides = this.getDefaultOverrides()
    }

    return results
  }

  getDefaultOverrides() {
    return {
      ignorePackages: [],
      licenseOverrides: {},
      riskOverrides: {},
      additionalLicenses: [],
      exclusions: {
        devDependencies: false,
        testDependencies: false,
        optionalDependencies: false,
        packages: []
      },
      requirements: {
        requireNoticeForApache: true,
        requireAttribution: true,
        checkCopyleft: true,
        checkNetworkService: true
      },
      customRiskLevels: {},
      notes: {}
    }
  }

  validateOverrides(overrides) {
    const issues = []

    if (typeof overrides !== 'object' || overrides === null) {
      return {
        valid: false,
        issues: ['根元素必须是对象']
      }
    }

    if (overrides.ignorePackages !== undefined) {
      if (!Array.isArray(overrides.ignorePackages)) {
        issues.push('ignorePackages 必须是数组')
      } else {
        for (let i = 0; i < overrides.ignorePackages.length; i++) {
          const pkg = overrides.ignorePackages[i]
          if (typeof pkg !== 'string') {
            issues.push(`ignorePackages[${i}] 必须是字符串`)
          }
        }
      }
    }

    if (overrides.licenseOverrides !== undefined) {
      if (typeof overrides.licenseOverrides !== 'object' || 
          overrides.licenseOverrides === null ||
          Array.isArray(overrides.licenseOverrides)) {
        issues.push('licenseOverrides 必须是对象')
      } else {
        for (const [pkg, info] of Object.entries(overrides.licenseOverrides)) {
          if (typeof info !== 'object' || info === null) {
            issues.push(`licenseOverrides["${pkg}"] 必须是对象`)
          } else {
            if (info.license !== undefined && typeof info.license !== 'string') {
              issues.push(`licenseOverrides["${pkg}"].license 必须是字符串`)
            }
            if (info.version !== undefined && typeof info.version !== 'string') {
              issues.push(`licenseOverrides["${pkg}"].version 必须是字符串`)
            }
            if (info.source !== undefined && typeof info.source !== 'string') {
              issues.push(`licenseOverrides["${pkg}"].source 必须是字符串`)
            }
          }
        }
      }
    }

    if (overrides.riskOverrides !== undefined) {
      if (typeof overrides.riskOverrides !== 'object' || 
          overrides.riskOverrides === null ||
          Array.isArray(overrides.riskOverrides)) {
        issues.push('riskOverrides 必须是对象')
      } else {
        const validLevels = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']
        for (const [license, level] of Object.entries(overrides.riskOverrides)) {
          if (typeof level !== 'string') {
            issues.push(`riskOverrides["${license}"] 必须是字符串`)
          } else if (!validLevels.includes(level.toUpperCase())) {
            issues.push(`riskOverrides["${license}"] 无效的风险等级: ${level}。有效值: ${validLevels.join(', ')}`)
          }
        }
      }
    }

    if (overrides.additionalLicenses !== undefined) {
      if (!Array.isArray(overrides.additionalLicenses)) {
        issues.push('additionalLicenses 必须是数组')
      } else {
        for (let i = 0; i < overrides.additionalLicenses.length; i++) {
          const license = overrides.additionalLicenses[i]
          if (typeof license !== 'object' || license === null) {
            issues.push(`additionalLicenses[${i}] 必须是对象`)
          } else {
            if (license.name === undefined || typeof license.name !== 'string') {
              issues.push(`additionalLicenses[${i}].name 必须是字符串`)
            }
            if (license.riskLevel !== undefined && 
                !['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'].includes(license.riskLevel)) {
              issues.push(`additionalLicenses[${i}].riskLevel 无效`)
            }
          }
        }
      }
    }

    if (overrides.exclusions !== undefined) {
      if (typeof overrides.exclusions !== 'object' || 
          overrides.exclusions === null ||
          Array.isArray(overrides.exclusions)) {
        issues.push('exclusions 必须是对象')
      } else {
        const booleanFields = ['devDependencies', 'testDependencies', 'optionalDependencies']
        for (const field of booleanFields) {
          if (overrides.exclusions[field] !== undefined && 
              typeof overrides.exclusions[field] !== 'boolean') {
            issues.push(`exclusions.${field} 必须是布尔值`)
          }
        }
        if (overrides.exclusions.packages !== undefined) {
          if (!Array.isArray(overrides.exclusions.packages)) {
            issues.push('exclusions.packages 必须是数组')
          } else {
            for (let i = 0; i < overrides.exclusions.packages.length; i++) {
              if (typeof overrides.exclusions.packages[i] !== 'string') {
                issues.push(`exclusions.packages[${i}] 必须是字符串`)
              }
            }
          }
        }
      }
    }

    if (overrides.requirements !== undefined) {
      if (typeof overrides.requirements !== 'object' || 
          overrides.requirements === null ||
          Array.isArray(overrides.requirements)) {
        issues.push('requirements 必须是对象')
      } else {
        const booleanFields = [
          'requireNoticeForApache', 
          'requireAttribution', 
          'checkCopyleft', 
          'checkNetworkService'
        ]
        for (const field of booleanFields) {
          if (overrides.requirements[field] !== undefined && 
              typeof overrides.requirements[field] !== 'boolean') {
            issues.push(`requirements.${field} 必须是布尔值`)
          }
        }
      }
    }

    if (overrides.customRiskLevels !== undefined) {
      if (typeof overrides.customRiskLevels !== 'object' || 
          overrides.customRiskLevels === null ||
          Array.isArray(overrides.customRiskLevels)) {
        issues.push('customRiskLevels 必须是对象')
      }
    }

    if (overrides.notes !== undefined) {
      if (typeof overrides.notes !== 'object' || 
          overrides.notes === null ||
          Array.isArray(overrides.notes)) {
        issues.push('notes 必须是对象')
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  mergeWithDefaults(overrides) {
    const defaults = this.getDefaultOverrides()
    
    return {
      ignorePackages: overrides.ignorePackages || defaults.ignorePackages,
      licenseOverrides: { ...defaults.licenseOverrides, ...overrides.licenseOverrides },
      riskOverrides: { ...defaults.riskOverrides, ...overrides.riskOverrides },
      additionalLicenses: overrides.additionalLicenses || defaults.additionalLicenses,
      exclusions: {
        devDependencies: overrides.exclusions?.devDependencies ?? defaults.exclusions.devDependencies,
        testDependencies: overrides.exclusions?.testDependencies ?? defaults.exclusions.testDependencies,
        optionalDependencies: overrides.exclusions?.optionalDependencies ?? defaults.exclusions.optionalDependencies,
        packages: [...defaults.exclusions.packages, ...(overrides.exclusions?.packages || [])]
      },
      requirements: {
        requireNoticeForApache: overrides.requirements?.requireNoticeForApache ?? defaults.requirements.requireNoticeForApache,
        requireAttribution: overrides.requirements?.requireAttribution ?? defaults.requirements.requireAttribution,
        checkCopyleft: overrides.requirements?.checkCopyleft ?? defaults.requirements.checkCopyleft,
        checkNetworkService: overrides.requirements?.checkNetworkService ?? defaults.requirements.checkNetworkService
      },
      customRiskLevels: { ...defaults.customRiskLevels, ...overrides.customRiskLevels },
      notes: { ...defaults.notes, ...overrides.notes }
    }
  }

  static hasOverridesFile(projectDir) {
    const overridesPath = path.join(projectDir, 'overrides.json')
    return fs.existsSync(overridesPath)
  }

  getLicenseOverride(packageName, version = null) {
    if (!this.overrides || !this.overrides.licenseOverrides) {
      return null
    }

    const override = this.overrides.licenseOverrides[packageName]
    if (!override) {
      return null
    }

    if (version && override.version) {
      const satisfies = this.versionMatches(version, override.version)
      if (!satisfies) {
        return null
      }
    }

    return {
      license: override.license,
      source: override.source || 'overrides.json',
      notes: override.notes || null
    }
  }

  getRiskOverride(licenseName) {
    if (!this.overrides || !this.overrides.riskOverrides) {
      return null
    }
    return this.overrides.riskOverrides[licenseName] || null
  }

  isPackageIgnored(packageName) {
    if (!this.overrides || !this.overrides.ignorePackages) {
      return false
    }
    return this.overrides.ignorePackages.includes(packageName)
  }

  isPackageExcluded(packageName, type = null) {
    if (!this.overrides || !this.overrides.exclusions) {
      return false
    }

    if (type) {
      if (type === 'development' && this.overrides.exclusions.devDependencies) {
        return true
      }
      if (type === 'test' && this.overrides.exclusions.testDependencies) {
        return true
      }
      if (type === 'optional' && this.overrides.exclusions.optionalDependencies) {
        return true
      }
    }

    if (this.overrides.exclusions.packages) {
      return this.overrides.exclusions.packages.includes(packageName)
    }

    return false
  }

  versionMatches(version, range) {
    if (!version || !range) {
      return true
    }

    const cleanVersion = version.replace(/^[\^~>=<]/, '')
    const cleanRange = range.replace(/^[\^~>=<]/, '')

    return cleanVersion === cleanRange || 
           cleanVersion.startsWith(cleanRange + '.')
  }
}

module.exports = OverridesParser
