class LicenseAuditor {
  constructor(configManager, licenseClassifier, exceptionManager) {
    this.config = configManager
    this.classifier = licenseClassifier
    this.exceptions = exceptionManager
  }

  auditDependencies(dependencies) {
    const result = {
      scanTime: new Date().toISOString(),
      summary: {
        total: 0,
        direct: 0,
        transitive: 0,
        allowed: 0,
        needsConfirmation: 0,
        forbidden: 0,
        unknown: 0,
        withExceptions: 0,
        warnings: []
      },
      packages: {
        direct: [],
        transitive: []
      },
      categorized: {
        allowed: [],
        needsConfirmation: [],
        forbidden: [],
        unknown: []
      },
      issues: []
    }

    const seenPackages = new Map()

    this.processDependencies(
      dependencies.direct,
      'direct',
      seenPackages,
      result
    )

    this.processDependencies(
      dependencies.transitive,
      'transitive',
      seenPackages,
      result
    )

    this.detectDuplicatePackages(seenPackages, result)

    result.summary.total = seenPackages.size
    result.summary.direct = dependencies.direct.length
    result.summary.transitive = dependencies.transitive.length

    return result
  }

  processDependencies(packages, type, seenPackages, result) {
    for (const pkg of packages) {
      const classification = this.classifier.classify(pkg.license)
      const exceptionCheck = this.exceptions.isExceptionApproved(pkg.name, pkg.version)

      const auditInfo = {
        name: pkg.name,
        version: pkg.version,
        license: pkg.license,
        normalizedLicense: classification.license,
        category: classification.category,
        risk: classification.risk,
        reason: classification.reason,
        isDirect: type === 'direct',
        parent: pkg.parent || null,
        exception: exceptionCheck.approved ? exceptionCheck.exception : null,
        exceptionExpired: exceptionCheck.expired || false,
        exceptionReason: exceptionCheck.reason
      }

      const key = `${pkg.name}@${pkg.version}`
      if (seenPackages.has(key)) {
        seenPackages.get(key).count++
      } else {
        seenPackages.set(key, { ...auditInfo, count: 1 })
      }

      result.packages[type].push(auditInfo)

      if (exceptionCheck.approved && !exceptionCheck.expired) {
        result.summary.withExceptions++
        result.categorized.allowed.push({ ...auditInfo, category: 'allowed_with_exception' })
      } else {
        switch (classification.category) {
          case 'allowed':
            result.summary.allowed++
            result.categorized.allowed.push(auditInfo)
            break
          case 'needs_confirmation':
            result.summary.needsConfirmation++
            result.categorized.needsConfirmation.push(auditInfo)
            this.addIssue(result, 'needs_confirmation', auditInfo)
            break
          case 'forbidden':
            result.summary.forbidden++
            result.categorized.forbidden.push(auditInfo)
            this.addIssue(result, 'forbidden', auditInfo)
            break
          case 'unknown':
            result.summary.unknown++
            result.categorized.unknown.push(auditInfo)
            this.addIssue(result, 'unknown', auditInfo)
            break
        }
      }
    }
  }

  addIssue(result, severity, auditInfo) {
    result.issues.push({
      severity,
      package: auditInfo.name,
      version: auditInfo.version,
      license: auditInfo.normalizedLicense,
      reason: auditInfo.reason,
      isDirect: auditInfo.isDirect,
      parent: auditInfo.parent
    })
  }

  detectDuplicatePackages(seenPackages, result) {
    const packagesByName = new Map()
    
    for (const [key, info] of seenPackages) {
      if (!packagesByName.has(info.name)) {
        packagesByName.set(info.name, [])
      }
      packagesByName.get(info.name).push(info)
    }

    for (const [name, versions] of packagesByName) {
      if (versions.length > 1) {
        result.summary.warnings.push({
          type: 'duplicate_package',
          package: name,
          versions: versions.map(v => v.version),
          licenses: versions.map(v => v.normalizedLicense)
        })
      }
    }
  }

  getOverallStatus(result) {
    if (result.summary.forbidden > 0) {
      return 'FAIL'
    }
    if (result.summary.needsConfirmation > 0 || result.summary.unknown > 0) {
      return 'WARN'
    }
    return 'PASS'
  }

  runAudit(dependencyReader, source) {
    const dependencies = dependencyReader.readDependencies(source)
    const auditResult = this.auditDependencies(dependencies)
    auditResult.status = this.getOverallStatus(auditResult)
    auditResult.source = source
    return auditResult
  }
}

module.exports = LicenseAuditor
