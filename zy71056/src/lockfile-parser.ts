import * as fs from 'fs';
import * as path from 'path';
import * as yarnLockfile from '@yarnpkg/lockfile';

export interface LockfilePackage {
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
}

export function parseLockfile(cwd: string): Map<string, LockfilePackage> {
  const packageLockPath = path.join(cwd, 'package-lock.json');
  const yarnLockPath = path.join(cwd, 'yarn.lock');

  if (fs.existsSync(packageLockPath)) {
    return parsePackageLock(packageLockPath);
  } else if (fs.existsSync(yarnLockPath)) {
    return parseYarnLock(yarnLockPath);
  }

  throw new Error('未找到 package-lock.json 或 yarn.lock');
}

function parsePackageLock(filePath: string): Map<string, LockfilePackage> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const packages = new Map<string, LockfilePackage>();

  if (data.packages) {
    for (const [pkgPath, pkgData] of Object.entries<any>(data.packages)) {
      if (pkgPath === '') continue;

      const name = pkgData.name || pkgPath.replace(/^node_modules\//, '');
      const version = pkgData.version;

      if (version) {
        packages.set(`${name}@${version}`, {
          name,
          version,
          license: pkgData.license,
          dependencies: pkgData.dependencies,
        });
      }
    }
  }

  return packages;
}

function parseYarnLock(filePath: string): Map<string, LockfilePackage> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yarnLockfile.parse(content);

  if (parsed.type !== 'success') {
    throw new Error('yarn.lock 解析失败');
  }

  const packages = new Map<string, LockfilePackage>();

  for (const [key, pkgData] of Object.entries<any>(parsed.object)) {
    const nameMatch = key.match(/^(.+)@/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const version = pkgData.version;

    if (version) {
      packages.set(`${name}@${version}`, {
        name,
        version,
        dependencies: pkgData.dependencies,
      });
    }
  }

  return packages;
}
