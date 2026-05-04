const LicenseRiskAssessor = require('./LicenseRiskAssessor')
const ScanEngine = require('./ScanEngine')

class CheckEngine {
  constructor(scanResult, options = {}) {
    this.scanResult = scanResult
    this.options = {
      strict: options.strict ?? false,
      includeWarnings: options.includeWarnings ?? true,
      ...options
    }

    this.riskAssessor = new LicenseRiskAssessor()
  }

  check() {
    const checkResult = {
      timestamp: new Date().toISOString(),
      passed: true,
      issues: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      dependencies: [],
      recommendations: []
    }

    if (!this.scanResult || !this.scanResult.dependencies) {
      checkResult.passed = false
      checkResult.issues.push({
        type: 'input-error',
        severity: 'critical',
        message: '无效的扫描结果',
        evidence: 'scanResult.dependencies 不存在'
      })
      return checkResult
    }

    if (this.scanResult.errors.length > 0) {
      for (const error of this.scanResult.errors) {
        checkResult.issues.push({
          type: 'scan-error',
          severity: 'high',
          message: error.message,
          file: error.file,
          line: error.line,
          evidence: error.source || error.category
        })
        checkResult.summary.high++
      }
    }

    this.checkLicenses(checkResult)
    this.checkCopyleft(checkResult)
    this.checkNetworkServiceRisk(checkResult)
    this.checkVersionConsistency(checkResult)
    this.checkNoticeRequirements(checkResult)
    this.checkAttributionRequirements(checkResult)
    this.checkThirdPartyDeclarations(checkResult)
    this.checkDuplicateDependencies(checkResult)
    this.checkUnknownLicenses(checkResult)

    this.generateSummary(checkResult)
    this.generateRecommendations(checkResult)

    checkResult.dependencies = this.scanResult.dependencies.map(dep => ({
      name: dep.name,
      version: dep.version,
      license: dep.license,
      normalizedLicense: dep.normalizedLicense,
      riskLevel: dep.riskLevel,
      issues: dep.issues || [],
      isCopyleft: dep.isCopyleft,
      isNetworkServiceRisk: dep.isNetworkServiceRisk,
      requiresNotice: dep.requiresNotice,
      requiresAttribution: dep.requiresAttribution
    }))

    checkResult.passed = checkResult.summary.critical === 0 && 
                        (this.options.strict ? checkResult.summary.high === 0 : true)

    return checkResult
  }

  checkLicenses(checkResult) {
    for (const dep of this.scanResult.dependencies) {
      if (!dep.license || dep.license === 'UNKNOWN') {
        const issue = {
          type: 'missing-license',
          severity: 'high',
          package: dep.name,
          version: dep.version,
          message: `依赖 ${dep.name} 缺少许可证信息`,
          evidence: dep.source,
          file: dep.sourceFile || dep.source,
          line: dep.line,
          explanation: '没有许可证信息的依赖无法确认是否可商用。建议：' +
                       '1) 检查包的官方文档 ' +
                       '2) 使用 overrides.json 手动指定许可证 ' +
                       '3) 考虑移除该依赖或寻找替代方案'
        }
        checkResult.issues.push(issue)
        checkResult.summary.high++

        if (!dep.issues) dep.issues = []
        dep.issues.push({ type: 'missing-license', severity: 'high' })
      }
    }
  }

  checkCopyleft(checkResult) {
    const copyleftDependencies = this.scanResult.dependencies.filter(dep => 
      dep.isCopyleft && !dep.isNetworkServiceRisk
    )

    for (const dep of copyleftDependencies) {
      const licenseInfo = dep.licenseInfo || {}
      const riskInfo = dep.riskInfo || {}

      const issue = {
        type: 'copyleft-license',
        severity: 'medium',
        package: dep.name,
        version: dep.version,
        license: dep.license,
        message: `依赖 ${dep.name} 使用 Copyleft 许可证: ${dep.license}`,
        evidence: dep.source,
        file: dep.sourceFile || dep.source,
        line: dep.line,
        explanation: this.generateCopyleftExplanation(dep),
        requirements: licenseInfo.requirements || [],
        risks: licenseInfo.risks || [],
        riskLevel: riskInfo.level
      }
      checkResult.issues.push(issue)
      checkResult.summary.medium++
    }
  }

  checkNetworkServiceRisk(checkResult) {
    const agplDependencies = this.scanResult.dependencies.filter(dep => 
      dep.isNetworkServiceRisk
    )

    for (const dep of agplDependencies) {
      const issue = {
        type: 'network-service-risk',
        severity: 'high',
        package: dep.name,
        version: dep.version,
        license: dep.license,
        message: `依赖 ${dep.name} 使用 AGPL 许可证，存在网络服务感染风险`,
        evidence: dep.source,
        file: dep.sourceFile || dep.source,
        line: dep.line,
        explanation: 'AGPL (Affero General Public License) 是强 Copyleft 许可证，' +
                     '即使您只是通过网络提供服务（如 SaaS），也需要向用户提供完整的源代码。' +
                     '这可能导致您的整个项目被迫开源。\n\n' +
                     '建议行动：\n' +
                     '1) 评估是否真的需要使用 AGPL 库\n' +
                     '2) 寻找许可证更宽松的替代方案（如 MIT/Apache）\n' +
                     '3) 如果必须使用，请咨询法律专家\n' +
                     '4) 确保完全理解并遵守许可证条款',
        impact: '高 - 可能导致整个项目被迫开源',
        mitigation: [
          '寻找 MIT/Apache 许可的替代库',
          '使用动态链接（不适用于 AGPL）',
          '隔离该组件为独立服务',
          '咨询法律专家'
        ]
      }
      checkResult.issues.push(issue)
      checkResult.summary.high++

      if (!dep.issues) dep.issues = []
      dep.issues.push({ type: 'agpl-risk', severity: 'high' })
    }
  }

  checkVersionConsistency(checkResult) {
    const npmDeps = this.scanResult.dependencies.filter(dep => 
      dep.sourceType === 'npm' && dep.source === 'package.json'
    )

    for (const dep of npmDeps) {
      if (dep.version && dep.resolvedVersion) {
        const versionRange = dep.version.replace(/^[\^~]/, '')
        const resolvedVersion = dep.resolvedVersion

        if (versionRange !== resolvedVersion && 
            !resolvedVersion.startsWith(versionRange + '.')) {
          const issue = {
            type: 'version-inconsistency',
            severity: 'low',
            package: dep.name,
            message: `依赖 ${dep.name} 版本不一致`,
            packageJsonVersion: dep.version,
            resolvedVersion: dep.resolvedVersion,
            evidence: `${dep.source} (package.json) vs lock file`,
            explanation: 'package.json 中的版本范围与锁文件中实际解析的版本不一致。' +
                         '这可能导致开发环境和生产环境使用不同版本的依赖。\n\n' +
                         '建议：运行 `npm install` 或 `pnpm install` 同步依赖版本'
          }
          checkResult.issues.push(issue)
          checkResult.summary.low++
        }
      }
    }
  }

  checkNoticeRequirements(checkResult) {
    const apacheDeps = this.scanResult.dependencies.filter(dep => 
      dep.requiresNotice
    )

    if (apacheDeps.length > 0 && !this.scanResult.noticeFile) {
      const depNames = apacheDeps.map(d => `${d.name}@${d.version}`).join(', ')
      
      const issue = {
        type: 'missing-notice-file',
        severity: 'medium',
        packages: apacheDeps.map(d => ({ name: d.name, version: d.version, license: d.license })),
        message: `发现 ${apacheDeps.length} 个 Apache-2.0 许可的依赖，但项目缺少 NOTICE 文件`,
        evidence: `涉及依赖: ${depNames}`,
        explanation: 'Apache-2.0 许可证要求：如果分发软件，必须保留 NOTICE 文件中的版权声明。' +
                     'NOTICE 文件应包含所有使用的 Apache-2.0 组件的版权信息。\n\n' +
                     '建议：创建 NOTICE 文件，包含以下信息：\n' +
                     '1) 您的项目版权声明\n' +
                     '2) 所有 Apache-2.0 依赖的版权声明\n' +
                     '3) 任何修改过的文件的变更说明',
        requiredActions: [
          '创建 NOTICE 文件',
          '添加所有 Apache-2.0 依赖的版权信息',
          '确保在分发时包含 NOTICE 文件'
        ]
      }
      checkResult.issues.push(issue)
      checkResult.summary.medium++
    }

    if (this.scanResult.noticeFile && apacheDeps.length > 0) {
      const noticeMentions = this.scanResult.noticeFile.thirdPartyMentions || []
      const mentionedPackages = new Set()

      for (const mention of noticeMentions) {
        for (const dep of apacheDeps) {
          if (mention.content.includes(dep.name) || 
              (dep.originalName && mention.content.includes(dep.originalName))) {
            mentionedPackages.add(dep.name)
          }
        }
      }

      const missingInNotice = apacheDeps.filter(dep => !mentionedPackages.has(dep.name))
      
      if (missingInNotice.length > 0) {
        const issue = {
          type: 'notice-incomplete',
          severity: 'low',
          packages: missingInNotice.map(d => ({ name: d.name, version: d.version })),
          message: `NOTICE 文件可能缺少 ${missingInNotice.length} 个 Apache-2.0 依赖的声明`,
          evidence: 'NOTICE 文件内容分析',
          explanation: '建议在 NOTICE 文件中明确列出所有 Apache-2.0 依赖的版权信息'
        }
        checkResult.issues.push(issue)
        checkResult.summary.low++
      }
    }
  }

  checkAttributionRequirements(checkResult) {
    const attributionRequired = this.scanResult.dependencies.filter(dep => 
      dep.requiresAttribution
    )

    const hasLicenseFile = this.scanResult.licenseFiles.length > 0

    if (attributionRequired.length > 0 && !hasLicenseFile) {
      const issue = {
        type: 'missing-license-file',
        severity: 'info',
        packages: attributionRequired.slice(0, 10).map(d => d.name),
        message: `发现 ${attributionRequired.length} 个需要归因的依赖，但项目根目录缺少 LICENSE 文件`,
        evidence: '项目根目录未检测到 LICENSE 文件',
        explanation: '大多数开源许可证要求保留原有的许可证声明。' +
                     '建议在项目根目录创建 LICENSE 文件说明您的项目许可证。'
      }
      checkResult.issues.push(issue)
      checkResult.summary.info++
    }
  }

  checkThirdPartyDeclarations(checkResult) {
    const thirdPartyDeps = this.scanResult.dependencies.filter(dep => 
      dep.sourceType === 'third-party'
    )

    const allDeps = new Set(this.scanResult.dependencies.map(dep => dep.name.toLowerCase()))
    const thirdPartyDeclared = new Set(thirdPartyDeps.map(dep => dep.name.toLowerCase()))

    const npmDeps = this.scanResult.dependencies.filter(dep => 
      dep.sourceType === 'npm' && dep.type !== 'transitive' && dep.type !== 'transitive-dev'
    )
    const pythonDeps = this.scanResult.dependencies.filter(dep => 
      dep.sourceType === 'python'
    )

    const directDeps = [...npmDeps, ...pythonDeps]
    const undeclaredThirdParty = directDeps.filter(dep => 
      !thirdPartyDeclared.has(dep.name.toLowerCase()) &&
      (dep.riskLevel === 'MEDIUM' || dep.riskLevel === 'HIGH')
    )

    if (undeclaredThirdParty.length > 0) {
      const issue = {
        type: 'third-party-undocumented',
        severity: 'info',
        packages: undeclaredThirdParty.map(d => ({ 
          name: d.name, 
          version: d.version, 
          license: d.license,
          riskLevel: d.riskLevel
        })),
        message: `发现 ${undeclaredThirdParty.length} 个中/高风险依赖未在 third_party.csv 中声明`,
        evidence: 'third_party.csv 与依赖扫描结果对比',
        explanation: '建议在 third_party.csv 中明确记录所有中高风险依赖的来源和许可证信息，' +
                     '便于后续审核和交付时提供完整的第三方声明。'
      }
      checkResult.issues.push(issue)
      checkResult.summary.info++
    }
  }

  checkDuplicateDependencies(checkResult) {
    const nameMap = new Map()

    for (const dep of this.scanResult.dependencies) {
      const key = dep.name.toLowerCase()
      if (!nameMap.has(key)) {
        nameMap.set(key, [])
      }
      nameMap.get(key).push(dep)
    }

    for (const [name, versions] of nameMap.entries()) {
      if (versions.length > 1) {
        const uniqueVersions = new Set(versions.map(v => v.version || 'unknown'))
        const uniqueLicenses = new Set(versions.map(v => v.license || 'UNKNOWN'))

        if (uniqueVersions.size > 1 || uniqueLicenses.size > 1) {
          const issue = {
            type: 'dependency-conflict',
            severity: uniqueLicenses.size > 1 ? 'medium' : 'low',
            package: name,
            versions: Array.from(uniqueVersions),
            licenses: Array.from(uniqueLicenses),
            occurrences: versions.map(v => ({
              version: v.version,
              license: v.license,
              source: v.source,
              sourceType: v.sourceType
            })),
            message: `依赖 ${name} 存在多个版本或许可证`,
            evidence: `版本: ${Array.from(uniqueVersions).join(', ')}; 许可证: ${Array.from(uniqueLicenses).join(', ')}`,
            explanation: uniqueLicenses.size > 1 
              ? '同一依赖存在多个不同许可证版本，这可能导致许可证冲突。' +
                '建议统一使用相同许可证的版本。'
              : '同一依赖存在多个版本，可能导致运行时行为不一致。' +
                '建议统一版本。'
          }
          checkResult.issues.push(issue)
          
          if (uniqueLicenses.size > 1) {
            checkResult.summary.medium++
          } else {
            checkResult.summary.low++
          }
        }
      }
    }
  }

  checkUnknownLicenses(checkResult) {
    const unknownLicenseDeps = this.scanResult.dependencies.filter(dep => 
      dep.normalizedLicense === 'UNKNOWN' || 
      dep.riskLevel === 'UNKNOWN'
    )

    if (unknownLicenseDeps.length > 0) {
      const issue = {
        type: 'unknown-licenses',
        severity: 'high',
        packages: unknownLicenseDeps.map(d => ({
          name: d.name,
          version: d.version,
          source: d.source
        })),
        message: `发现 ${unknownLicenseDeps.length} 个许可证未知的依赖`,
        evidence: '许可证扫描结果',
        explanation: '许可证未知的依赖存在法律风险，无法确认是否可商用。\n\n' +
                     '建议行动：\n' +
                     '1) 检查包的官方文档或源代码仓库\n' +
                     '2) 查看 node_modules 中的 LICENSE 文件\n' +
                     '3) 使用 overrides.json 手动指定许可证\n' +
                     '4) 考虑寻找有明确许可证的替代方案',
        recommendation: '在确认许可证前，谨慎使用这些依赖进行商用分发'
      }
      checkResult.issues.push(issue)
      checkResult.summary.high++
    }
  }

  generateCopyleftExplanation(dep) {
    const license = dep.normalizedLicense || dep.license
    const explanations = {
      'GPL-2.0': 'GPL-2.0 是强 Copyleft 许可证。如果您的软件链接（静态或动态）到 GPL 库，' +
                  '整个衍生作品必须以 GPL-2.0 许可证分发。这意味着您的项目源代码必须公开。',
      'GPL-3.0': 'GPL-3.0 是强 Copyleft 许可证。包含额外的反 tivoization 条款，' +
                  '防止在嵌入式设备中锁定 GPL 软件。整个衍生作品必须以 GPL-3.0 分发。',
      'LGPL-2.1': 'LGPL-2.1 是弱 Copyleft 许可证。动态链接时不感染主项目。' +
                  '但如果修改了 LGPL 库本身，修改后的库必须开源。',
      'LGPL-3.0': 'LGPL-3.0 是弱 Copyleft 许可证。版本 3 与 GPL-3.0 兼容。' +
                  '动态链接时不感染主项目，但库的修改必须开源。',
      'MPL-2.0': 'MPL-2.0 是文件级 Copyleft 许可证。比 GPL 更灵活。' +
                  '只有修改过的 MPL 文件需要开源，新增的文件可以保持专有。'
    }

    return explanations[license] || 
           `${license} 是 Copyleft 许可证。使用时需要注意衍生作品的许可证要求。`
  }

  generateSummary(checkResult) {
    const stats = this.scanResult.statistics || {}
    const riskLevel = stats.byRiskLevel || {}

    checkResult.overallRisk = this.calculateOverallRisk(checkResult)
    
    checkResult.statistics = {
      totalDependencies: stats.totalDependencies || 0,
      byRiskLevel: {
        SAFE: riskLevel.SAFE || 0,
        LOW: riskLevel.LOW || 0,
        MEDIUM: riskLevel.MEDIUM || 0,
        HIGH: riskLevel.HIGH || 0,
        UNKNOWN: riskLevel.UNKNOWN || 0
      },
      issues: checkResult.summary
    }
  }

  calculateOverallRisk(checkResult) {
    if (checkResult.summary.critical > 0) return 'CRITICAL'
    if (checkResult.summary.high > 0) return 'HIGH'
    if (checkResult.summary.medium > 0) return 'MEDIUM'
    if (checkResult.summary.low > 0) return 'LOW'
    return 'SAFE'
  }

  generateRecommendations(checkResult) {
    const recommendations = []

    if (checkResult.summary.high > 0) {
      recommendations.push({
        priority: 'high',
        title: '立即处理高风险问题',
        description: `发现 ${checkResult.summary.high} 个高风险问题，建议在商用前优先解决。`,
        actions: [
          '检查并解决所有 AGPL 许可证依赖',
          '确认所有未知许可证的依赖',
          '修复所有扫描错误'
        ]
      })
    }

    const copyleftIssues = checkResult.issues.filter(i => i.type === 'copyleft-license')
    if (copyleftIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: '评估 Copyleft 许可证影响',
        description: `发现 ${copyleftIssues.length} 个 Copyleft 许可证依赖。`,
        actions: [
          '确认链接方式（静态 vs 动态）',
          '评估对项目整体许可证的影响',
          '咨询法律专家确认合规性'
        ]
      })
    }

    const missingNotice = checkResult.issues.find(i => i.type === 'missing-notice-file')
    if (missingNotice) {
      recommendations.push({
        priority: 'medium',
        title: '创建 NOTICE 文件',
        description: '项目使用了 Apache-2.0 许可的依赖，需要创建 NOTICE 文件。',
        actions: [
          '在项目根目录创建 NOTICE 文件',
          '列出所有 Apache-2.0 依赖的版权信息',
          '添加您的项目版权声明'
        ]
      })
    }

    const apacheDeps = this.scanResult.dependencies.filter(dep => 
      dep.requiresNotice && dep.sourceType !== 'third-party'
    )
    if (apacheDeps.length > 0) {
      recommendations.push({
        priority: 'low',
        title: '完善 third_party.csv 记录',
        description: '建议在 third_party.csv 中记录所有第三方依赖信息。',
        actions: [
          '添加所有直接依赖的许可证信息',
          '记录依赖的来源和版本',
          '添加任何必要的说明和备注'
        ]
      })
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'info',
        title: '许可证合规状态良好',
        description: '未发现高风险问题。继续保持良好的依赖管理实践。',
        actions: [
          '定期运行许可证检查',
          '及时更新 third_party.csv',
          '新依赖引入前评估许可证风险'
        ]
      })
    }

    checkResult.recommendations = recommendations
  }
}

module.exports = CheckEngine
