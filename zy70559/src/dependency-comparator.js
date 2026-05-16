const semver = require('semver');
const LicenseNormalizer = require('./license-normalizer');

class DependencyComparator {
  constructor() {
    this.licenseNormalizer = new LicenseNormalizer();
  }

  compare(oldLock, newLock) {
    if (!oldLock || !newLock) {
      return null;
    }

    const oldDeps = this.createDependencyMap(oldLock.packages);
    const newDeps = this.createDependencyMap(newLock.packages);
    const allNames = new Set([...Object.keys(oldDeps), ...Object.keys(newDeps)]);

    const added = [];
    const removed = [];
    const changed = [];
    const unchanged = [];

    for (const name of allNames) {
      const oldDep = oldDeps[name];
      const newDep = newDeps[name];

      if (!oldDep && newDep) {
        added.push(this.createDependencyInfo(name, newDep, 'added'));
      } else if (oldDep && !newDep) {
        removed.push(this.createDependencyInfo(name, oldDep, 'removed'));
      } else if (oldDep && newDep) {
        const changeInfo = this.compareDependency(name, oldDep, newDep);
        if (changeInfo.hasChanges) {
          changed.push(changeInfo);
        } else {
          unchanged.push(this.createDependencyInfo(name, newDep, 'unchanged'));
        }
      }
    }

    return {
      added,
      removed,
      changed,
      unchanged,
      summary: {
        total: allNames.size,
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        unchanged: unchanged.length
      }
    };
  }

  createDependencyMap(packages) {
    const map = {};
    for (const pkg of packages) {
      map[pkg.name] = pkg;
    }
    return map;
  }

  compareDependency(name, oldDep, newDep) {
    const changes = [];
    const oldVersion = this.getVersion(oldDep);
    const newVersion = this.getVersion(newDep);
    const oldLicense = this.getLicense(oldDep);
    const newLicense = this.getLicense(newDep);

    let versionChange = null;
    if (oldVersion !== newVersion) {
      versionChange = {
        type: 'version',
        old: oldVersion,
        new: newVersion,
        changeType: this.getVersionChangeType(oldVersion, newVersion)
      };
      changes.push(versionChange);
    }

    let licenseChange = null;
    if (oldLicense !== newLicense) {
      const oldNormalized = this.licenseNormalizer.normalize(oldLicense, name);
      const newNormalized = this.licenseNormalizer.normalize(newLicense, name);
      licenseChange = {
        type: 'license',
        old: oldLicense,
        new: newLicense,
        oldNormalized,
        newNormalized
      };
      changes.push(licenseChange);
    }

    return {
      name,
      hasChanges: changes.length > 0,
      changes,
      versionChange,
      licenseChange,
      old: this.createDependencyInfo(name, oldDep, 'old'),
      new: this.createDependencyInfo(name, newDep, 'new')
    };
  }

  getVersion(dep) {
    return dep.version || null;
  }

  getLicense(dep) {
    return dep.license || null;
  }

  getVersionChangeType(oldVersion, newVersion) {
    if (!oldVersion || !newVersion) return 'unknown';

    try {
      if (semver.eq(oldVersion, newVersion)) return 'none';
      if (semver.gt(newVersion, oldVersion)) {
        const oldMajor = semver.major(oldVersion);
        const newMajor = semver.major(newVersion);
        const oldMinor = semver.minor(oldVersion);
        const newMinor = semver.minor(newVersion);

        if (newMajor > oldMajor) return 'major';
        if (newMinor > oldMinor) return 'minor';
        return 'patch';
      }
      if (semver.lt(newVersion, oldVersion)) return 'downgrade';
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  createDependencyInfo(name, dep, status) {
    const version = this.getVersion(dep);
    const license = this.getLicense(dep);
    const normalizedLicense = this.licenseNormalizer.normalize(license, name);

    return {
      name,
      version,
      license,
      normalizedLicense,
      status,
      path: dep.path
    };
  }

  getLicenseErrors() {
    return this.licenseNormalizer.getErrors();
  }
}

module.exports = DependencyComparator;
