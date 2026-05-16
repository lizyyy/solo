import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export async function discoverPackages(config, rootDir = process.cwd()) {
  const packages = [];

  for (const pattern of config.packages) {
    const matches = await glob(pattern, {
      cwd: rootDir,
      absolute: true,
      onlyDirectories: true,
    });

    for (const match of matches) {
      const pkg = await readPackageInfo(match);
      if (pkg) {
        packages.push(pkg);
      }
    }
  }

  return packages;
}

async function readPackageInfo(dir) {
  const packageJsonPath = path.join(dir, 'package.json');
  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkgJson = JSON.parse(content);
    return {
      name: pkgJson.name,
      version: pkgJson.version || '0.0.0',
      path: dir,
      relativePath: path.relative(process.cwd(), dir),
      packageJsonPath,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export function findPackageForFilePath(filePath, packages) {
  for (const pkg of packages) {
    if (filePath.startsWith(pkg.path + path.sep)) {
      return pkg;
    }
  }
  return null;
}

export function matchPackagePattern(packageName, pattern) {
  if (pattern === packageName) {
    return true;
  }

  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return packageName.startsWith(prefix);
  }

  return false;
}
