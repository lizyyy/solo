const fs = require('fs');
const path = require('path');
const yarnLockfile = require('@yarnpkg/lockfile');
const { BadRowCollector, ParseError } = require('./errors');

class LockfileParser {
  constructor(options = {}) {
    this.badRows = new BadRowCollector();
    this.options = {
      strict: options.strict || false,
      ...options
    };
  }

  parse(filePath) {
    const absolutePath = path.resolve(filePath);
    const filename = path.basename(absolutePath);

    if (!fs.existsSync(absolutePath)) {
      throw new ParseError(`Lockfile not found: ${absolutePath}`, { filePath: absolutePath });
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');

    if (filename.startsWith('package-lock') && filename.endsWith('.json')) {
      return this.parsePackageLock(content, absolutePath);
    } else if (filename === 'yarn.lock') {
      return this.parseYarnLock(content, absolutePath);
    } else if (filename === 'pnpm-lock.yaml') {
      return this.parsePnpmLock(content, absolutePath);
    }

    throw new ParseError(`Unsupported lockfile format: ${filename}`, { filename });
  }

  parsePackageLock(content, source) {
    const packages = [];
    let json;

    try {
      json = JSON.parse(content);
    } catch (e) {
      throw new ParseError(`Invalid JSON in package-lock.json`, {
        source,
        error: e.message
      });
    }

    const lockfileVersion = json.lockfileVersion || 1;

    if (lockfileVersion >= 2) {
      for (const [depPath, data] of Object.entries(json.packages || {})) {
        if (depPath === '') continue;
        const name = depPath.split('node_modules/').pop();
        packages.push({
          name,
          version: data.version,
          license: this.extractLicense(data),
          resolved: data.resolved,
          integrity: data.integrity,
          dependencies: data.dependencies ? Object.keys(data.dependencies) : [],
          dev: data.dev || false,
          path: depPath
        });
      }
    } else {
      this.traversePackageLockDeps(json.dependencies, packages, source);
    }

    return {
      format: 'package-lock.json',
      version: lockfileVersion,
      packages: this.deduplicatePackages(packages),
      badRows: this.badRows
    };
  }

  traversePackageLockDeps(dependencies, packages, source, prefix = '') {
    if (!dependencies) return;

    for (const [name, data] of Object.entries(dependencies)) {
      try {
        packages.push({
          name,
          version: data.version,
          license: this.extractLicense(data),
          resolved: data.resolved,
          integrity: data.integrity,
          dev: data.dev || false,
          path: prefix + name
        });

        if (data.dependencies) {
          this.traversePackageLockDeps(data.dependencies, packages, source, prefix + name + ' > ');
        }
      } catch (e) {
        this.badRows.add(
          { name, data: JSON.stringify(data).substring(0, 500) },
          `Failed to parse dependency: ${e.message}`,
          source
        );
      }
    }
  }

  parseYarnLock(content, source) {
    const result = yarnLockfile.parse(content);
    const packages = [];

    if (result.type !== 'success') {
      throw new ParseError('Failed to parse yarn.lock', { source });
    }

    for (const [key, data] of Object.entries(result.object)) {
      const match = key.match(/^(.+?)@(.+?)$/);
      if (!match) {
        this.badRows.add(key, 'Invalid dependency key format', source);
        continue;
      }

      const name = match[1];
      packages.push({
        name,
        version: data.version,
        license: this.extractLicense(data),
        resolved: data.resolved,
        integrity: data.integrity,
        dependencies: data.dependencies ? Object.keys(data.dependencies) : [],
        dev: false
      });
    }

    return {
      format: 'yarn.lock',
      packages: this.deduplicatePackages(packages),
      badRows: this.badRows
    };
  }

  parsePnpmLock(content, source) {
    const packages = [];
    const lines = content.split('\n');
    let inPackages = false;
    let currentPackage = null;
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      try {
        if (line.trim().startsWith('packages:')) {
          inPackages = true;
          continue;
        }

        if (!inPackages) continue;

        const indent = line.match(/^\s*/)[0].length;
        const trimmed = line.trim();

        if (trimmed.startsWith('/') && indent === 2) {
          if (currentPackage) {
            packages.push(currentPackage);
          }
          const pkgMatch = trimmed.match(/^\/(.+?)@([^:]+):?$/);
          if (pkgMatch) {
            currentPackage = {
              name: pkgMatch[1],
              version: pkgMatch[2].replace(/[^\w.-]/g, ''),
              license: null,
              resolved: null,
              integrity: null,
              dependencies: []
            };
          } else {
            this.badRows.add(trimmed, 'Could not parse package identifier', source, lineNum);
            currentPackage = null;
          }
          indentLevel = indent;
          continue;
        }

        if (currentPackage && indent > indentLevel) {
          if (trimmed.startsWith('resolution:')) {
            currentPackage.resolved = trimmed.split('resolution:')[1].trim();
          } else if (trimmed.startsWith('integrity:')) {
            currentPackage.integrity = trimmed.split('integrity:')[1].trim();
          }
        }
      } catch (e) {
        this.badRows.add(line, `Parse error: ${e.message}`, source, lineNum);
      }
    }

    if (currentPackage) {
      packages.push(currentPackage);
    }

    return {
      format: 'pnpm-lock.yaml',
      packages: this.deduplicatePackages(packages),
      badRows: this.badRows
    };
  }

  extractLicense(data) {
    if (!data) return null;
    if (data.license) return data.license;
    if (data.licenses) {
      if (Array.isArray(data.licenses)) {
        return data.licenses.map(l => l.type || l).join(' OR ');
      }
      return data.licenses.type || data.licenses;
    }
    return null;
  }

  deduplicatePackages(packages) {
    const seen = new Map();

    for (const pkg of packages) {
      const key = `${pkg.name}@${pkg.version}`;
      if (!seen.has(key)) {
        seen.set(key, pkg);
      }
    }

    return Array.from(seen.values());
  }

  getBadRows() {
    return this.badRows;
  }
}

module.exports = { LockfileParser };