class ScanComparator {
  compare(scan1, scan2) {
    const result = {
      comparisonTime: new Date().toISOString(),
      scan1: { time: scan1.scanTime, status: scan1.status },
      scan2: { time: scan2.scanTime, status: scan2.status },
      summary: {
        added: 0,
        removed: 0,
        changed: 0,
        licenseChanges: 0,
        categoryChanges: 0,
        newIssues: 0,
        resolvedIssues: 0
      },
      packages: {
        added: [],
        removed: [],
        changed: [],
        unchanged: []
      },
      issues: {
        new: [],
        resolved: []
      },
      licenseSummary: {
        scan1: this.countLicenses(scan1),
        scan2: this.countLicenses(scan2)
      }
    }

    const scan1Packages = this.buildPackageMap(scan1)
    const scan2Packages = this.buildPackageMap(scan2)
    const scan1Issues = this.buildIssueMap(scan1)
    const scan2Issues = this.buildIssueMap(scan2)

    for (const [key, pkg2] of scan2Packages) {
      const pkg1 = scan1Packages.get(key)
      
      if (!pkg1) {
        result.packages.added.push(pkg2)
        result.summary.added++
      } else if (this.hasPackageChanged(pkg1, pkg2)) {
        const change = this.buildChange(pkg1, pkg2)
        result.packages.changed.push(change)
        result.summary.changed++
        if (change.licenseChanged) result.summary.licenseChanges++
        if (change.categoryChanged) result.summary.categoryChanges++
      } else {
        result.packages.unchanged.push(pkg2)
      }
    }

    for (const [key, pkg1] of scan1Packages) {
      if (!scan2Packages.has(key)) {
        result.packages.removed.push(pkg1)
        result.summary.removed++
      }
    }

    for (const [key, issue2] of scan2Issues) {
      if (!scan1Issues.has(key)) {
        result.issues.new.push(issue2)
        result.summary.newIssues++
      }
    }

    for (const [key, issue1] of scan1Issues) {
      if (!scan2Issues.has(key)) {
        result.issues.resolved.push(issue1)
        result.summary.resolvedIssues++
      }
    }

    return result
  }

  buildPackageMap(scan) {
    const map = new Map()
    const allPackages = [...scan.packages.direct, ...scan.packages.transitive]
    
    for (const pkg of allPackages) {
      const key = `${pkg.name}@${pkg.version}`
      map.set(key, pkg)
    }
    
    return map
  }

  buildIssueMap(scan) {
    const map = new Map()
    
    for (const issue of scan.issues) {
      const key = `${issue.package}@${issue.version}-${issue.severity}`
      map.set(key, issue)
    }
    
    return map
  }

  hasPackageChanged(pkg1, pkg2) {
    return pkg1.license !== pkg2.license ||
           pkg1.normalizedLicense !== pkg2.normalizedLicense ||
           pkg1.category !== pkg2.category ||
           pkg1.risk !== pkg2.risk
  }

  buildChange(pkg1, pkg2) {
    return {
      name: pkg1.name,
      version: pkg1.version,
      from: {
        license: pkg1.license,
        normalizedLicense: pkg1.normalizedLicense,
        category: pkg1.category,
        risk: pkg1.risk
      },
      to: {
        license: pkg2.license,
        normalizedLicense: pkg2.normalizedLicense,
        category: pkg2.category,
        risk: pkg2.risk
      },
      licenseChanged: pkg1.normalizedLicense !== pkg2.normalizedLicense,
      categoryChanged: pkg1.category !== pkg2.category,
      riskChanged: pkg1.risk !== pkg2.risk
    }
  }

  countLicenses(scan) {
    const counts = {}
    
    for (const pkg of [...scan.packages.direct, ...scan.packages.transitive]) {
      const license = pkg.normalizedLicense || 'UNKNOWN'
      counts[license] = (counts[license] || 0) + 1
    }
    
    return counts
  }
}

module.exports = ScanComparator
