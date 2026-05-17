const fs = require('fs');
const path = require('path');
const semver = require('semver');
const spdxSatisfies = require('spdx-satisfies');
const spdxLicenseList = require('spdx-license-list/simple');
const { BadRowCollector, LicenseNotFoundError, SnapshotMismatchError } = require('./errors');

class SnapshotManager {
  constructor(options = {}) {
    this.options = {
      snapshotFile: options.snapshotFile || '.license-snapshot.json',
      allowedLicenses: options.allowedLicenses || [],
      deniedLicenses: options.deniedLicenses || [],
      ...options
    };
    this.badRows = new BadRowCollector();
  }

  createSnapshot(packages, metadata = {}) {
    const snapshot = {
      version: '1.0.0',
      created: new Date().toISOString(),
      metadata: {
        totalPackages: packages.length,
        ...metadata
      },
      packages: packages.map(pkg => ({
        name: pkg.name,
        version: pkg.version,
        license: this.normalizeLicense(pkg.license),
        licenseSource: pkg.licenseSource || 'lockfile',
        resolved: pkg.resolved || null,
        dev: pkg.dev || false
      })),
      summary: this.generateSummary(packages)
    };

    return snapshot;
  }

  saveSnapshot(snapshot, filePath = null) {
    const outputPath = filePath || this.options.snapshotFile;
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return outputPath;
  }

  loadSnapshot(filePath = null) {
    const inputPath = filePath || this.options.snapshotFile;

    if (!fs.existsSync(inputPath)) {
      return null;
    }

    const content = fs.readFileSync(inputPath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new SnapshotMismatchError('Invalid snapshot file format', {
        filePath: inputPath,
        error: e.message
      });
    }
  }

  compare(oldSnapshot, newPackages) {
    const results = {
      added: [],
      removed: [],
      upgraded: [],
      downgraded: [],
      licenseChanged: [],
      unchanged: [],
      hasChanges: false
    };

    const oldPackagesMap = new Map();
    if (oldSnapshot && oldSnapshot.packages) {
      for (const pkg of oldSnapshot.packages) {
        oldPackagesMap.set(pkg.name, pkg);
      }
    }

    const newPackagesMap = new Map();
    for (const pkg of newPackages) {
      newPackagesMap.set(pkg.name, pkg);
    }

    for (const newPkg of newPackages) {
      const oldPkg = oldPackagesMap.get(newPkg.name);

      if (!oldPkg) {
        const risk = this.assessRisk(newPkg);
        results.added.push({
          ...newPkg,
          normalizedLicense: this.normalizeLicense(newPkg.license),
          risk
        });
        continue;
      }

      const versionCompare = semver.compare(newPkg.version, oldPkg.version);
      const oldLicense = this.normalizeLicense(oldPkg.license);
      const newLicense = this.normalizeLicense(newPkg.license);
      const licenseChanged = oldLicense !== newLicense;

      if (licenseChanged) {
        const risk = this.assessRisk(newPkg);
        results.licenseChanged.push({
          name: newPkg.name,
          oldVersion: oldPkg.version,
          newVersion: newPkg.version,
          oldLicense,
          newLicense,
          resolved: newPkg.resolved,
          dev: newPkg.dev,
          risk
        });
      } else if (versionCompare > 0) {
        results.upgraded.push({
          name: newPkg.name,
          oldVersion: oldPkg.version,
          newVersion: newPkg.version,
          license: newLicense,
          resolved: newPkg.resolved,
          dev: newPkg.dev
        });
      } else if (versionCompare < 0) {
        results.downgraded.push({
          name: newPkg.name,
          oldVersion: oldPkg.version,
          newVersion: newPkg.version,
          license: newLicense,
          resolved: newPkg.resolved,
          dev: newPkg.dev
        });
      } else {
        results.unchanged.push({
          name: newPkg.name,
          version: newPkg.version,
          license: newLicense,
          resolved: newPkg.resolved,
          dev: newPkg.dev
        });
      }
    }

    for (const oldPkg of oldPackagesMap.values()) {
      if (!newPackagesMap.has(oldPkg.name)) {
        results.removed.push({
          name: oldPkg.name,
          version: oldPkg.version,
          license: this.normalizeLicense(oldPkg.license),
          dev: oldPkg.dev
        });
      }
    }

    results.hasChanges =
      results.added.length > 0 ||
      results.removed.length > 0 ||
      results.upgraded.length > 0 ||
      results.downgraded.length > 0 ||
      results.licenseChanged.length > 0;

    return results;
  }

  normalizeLicense(license) {
    if (!license) return 'UNKNOWN';
    if (typeof license !== 'string') return String(license);

    let normalized = license.trim();

    normalized = normalized
      .replace(/^['"]|['"]$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\bapache\s+license\b/i, 'Apache')
      .replace(/\bversion\b/i, 'v')
      .replace(/\blicense\b/i, '')
      .trim();

    if (/^mit$/i.test(normalized)) return 'MIT';
    if (/^apache-?\s*[\d.]+$/i.test(normalized)) {
      const version = normalized.match(/[\d.]+/)?.[0] || '2.0';
      return `Apache-${version}`;
    }
    if (/^isc$/i.test(normalized)) return 'ISC';
    if (/^bsd$/i.test(normalized)) return 'BSD';
    if (/^(new|modified)\s+bsd$/i.test(normalized)) return 'BSD-3-Clause';
    if (/^simplified\s+bsd$/i.test(normalized)) return 'BSD-2-Clause';
    if (/^gpl$/i.test(normalized)) return 'GPL';
    if (/^lgpl$/i.test(normalized)) return 'LGPL';
    if (/^mpl$/i.test(normalized)) return 'MPL';
    if (/^cc-/i.test(normalized)) return normalized.toUpperCase();
    if (/^unlicense$/i.test(normalized)) return 'Unlicense';
    if (/^wtfpl$/i.test(normalized)) return 'WTFPL';

    if (spdxLicenseList.has(normalized)) {
      return normalized;
    }

    return normalized;
  }

  assessRisk(pkg) {
    const license = this.normalizeLicense(pkg.license);
    const risks = [];

    if (license === 'UNKNOWN' || !license) {
      risks.push({
        level: 'high',
        code: 'UNKNOWN_LICENSE',
        message: 'License information not found'
      });
    }

    if (this.options.deniedLicenses.length > 0) {
      for (const denied of this.options.deniedLicenses) {
        try {
          if (spdxSatisfies(license, denied)) {
            risks.push({
              level: 'critical',
              code: 'DENIED_LICENSE',
              message: `License ${license} is in denied list (matches ${denied})`
            });
          }
        } catch (e) {
          if (license.toLowerCase().includes(denied.toLowerCase())) {
            risks.push({
              level: 'critical',
              code: 'DENIED_LICENSE',
              message: `License ${license} appears to match denied pattern ${denied}`
            });
          }
        }
      }
    }

    if (this.options.allowedLicenses.length > 0 && risks.filter(r => r.code === 'DENIED_LICENSE').length === 0) {
      let allowed = false;
      for (const allowedLicense of this.options.allowedLicenses) {
        try {
          if (spdxSatisfies(license, allowedLicense)) {
            allowed = true;
            break;
          }
        } catch (e) {
          if (license.toLowerCase().includes(allowedLicense.toLowerCase())) {
            allowed = true;
            break;
          }
        }
      }
      if (!allowed && license !== 'UNKNOWN') {
        risks.push({
          level: 'medium',
          code: 'NOT_IN_ALLOWED_LIST',
          message: `License ${license} is not in the allowed list`
        });
      }
    }

    if (/gpl|agpl/i.test(license) && !/lgpl/i.test(license)) {
      risks.push({
        level: 'medium',
        code: 'COPYLEFT_LICENSE',
        message: `Copyleft license ${license} may have implications`
      });
    }

    if (risks.length === 0) {
      risks.push({
        level: 'low',
        code: 'OK',
        message: 'No issues detected'
      });
    }

    return {
      highestLevel: this.getHighestRiskLevel(risks),
      risks
    };
  }

  getHighestRiskLevel(risks) {
    const levels = { critical: 4, high: 3, medium: 2, low: 1 };
    let highest = 'low';
    for (const risk of risks) {
      if (levels[risk.level] > levels[highest]) {
        highest = risk.level;
      }
    }
    return highest;
  }

  generateSummary(packages) {
    const licenseCounts = {};
    let devCount = 0;

    for (const pkg of packages) {
      const license = this.normalizeLicense(pkg.license);
      licenseCounts[license] = (licenseCounts[license] || 0) + 1;
      if (pkg.dev) devCount++;
    }

    return {
      totalPackages: packages.length,
      devPackages: devCount,
      productionPackages: packages.length - devCount,
      licenseDistribution: licenseCounts,
      uniqueLicenses: Object.keys(licenseCounts).length
    };
  }

  mergeLicenses(packages) {
    const licenseGroups = {};

    for (const pkg of packages) {
      const license = this.normalizeLicense(pkg.license);
      if (!licenseGroups[license]) {
        licenseGroups[license] = {
          license,
          packages: [],
          count: 0,
          devCount: 0
        };
      }
      licenseGroups[license].packages.push(pkg);
      licenseGroups[license].count++;
      if (pkg.dev) {
        licenseGroups[license].devCount++;
      }
    }

    return Object.values(licenseGroups).sort((a, b) => b.count - a.count);
  }

  getBadRows() {
    return this.badRows;
  }
}

module.exports = { SnapshotManager };