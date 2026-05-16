const fs = require('fs');
const path = require('path');

class LockfileParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.errors = [];
  }

  parse() {
    const content = fs.readFileSync(this.filePath, 'utf8');
    if (this.filePath.includes('package-lock.json')) return this.parsePackageLock(content);
    throw new Error('Unsupported lock file format');
  }

  parsePackageLock(content) {
    try {
      const data = JSON.parse(content);
      const packages = [];
      if (data.packages) {
        for (const [pkgPath, pkgInfo] of Object.entries(data.packages)) {
          if (pkgPath === '') continue;
          const name = pkgInfo.name || pkgPath.split('/').pop();
          const version = pkgInfo.version;
          if (!version) {
            this.addError(name, 'missing version', pkgPath);
            continue;
          }
          packages.push({
            name,
            version,
            license: this.extractLicense(pkgInfo),
            path: pkgPath,
            dev: pkgInfo.dev || false
          });
        }
      }
      return {
        type: 'package-lock',
        packages,
        errors: this.errors
      };
    } catch (e) {
      this.addError('root', 'JSON parse failed', '/');
      return {
        type: 'package-lock',
        packages: [],
        errors: this.errors
      };
    }
  }

  extractLicense(pkgInfo) {
    if (pkgInfo.license) return pkgInfo.license;
    if (pkgInfo.licenses) {
      return Array.isArray(pkgInfo.licenses)
        ? pkgInfo.licenses.map(l => l.type || l).join(' OR ')
        : (pkgInfo.licenses.type || pkgInfo.licenses);
    }
    return null;
  }

  addError(packageName, reason, location) {
    this.errors.push({
      packageName,
      reason,
      location,
      file: this.filePath,
      timestamp: new Date().toISOString()
    });
  }

  getErrors() {
    return this.errors;
  }
}

module.exports = LockfileParser;