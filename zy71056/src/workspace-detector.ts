import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface WorkspacePackage {
  name: string;
  version: string;
  path: string;
  isPrivate: boolean;
  license: string | null;
}

export async function detectWorkspacePackages(cwd: string): Promise<Map<string, WorkspacePackage>> {
  const rootPkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(rootPkgPath)) {
    return new Map();
  }

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
  const workspaces = rootPkg.workspaces || [];

  if (workspaces.length === 0) {
    return new Map();
  }

  const packages = new Map<string, WorkspacePackage>();

  for (const pattern of workspaces) {
    const matches = await glob(pattern, {
      cwd,
      absolute: true,
    });

    for (const pkgPath of matches) {
      const pkgJsonPath = path.join(pkgPath, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (pkg.name) {
          packages.set(pkg.name, {
            name: pkg.name,
            version: pkg.version || '0.0.0',
            path: pkgPath,
            isPrivate: !!pkg.private,
            license: pkg.license || null,
          });
        }
      } catch {
        continue;
      }
    }
  }

  return packages;
}

export function isWorkspacePackage(
  packageName: string,
  workspacePackages: Map<string, WorkspacePackage>
): WorkspacePackage | null {
  return workspacePackages.get(packageName) || null;
}

export function findLicenseFile(packagePath: string): string | null {
  const licensePatterns = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE',
    'LICENCE.md',
    'LICENCE.txt',
    'License',
    'License.md',
  ];

  for (const fileName of licensePatterns) {
    const filePath = path.join(packagePath, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

export function readLicenseText(licensePath: string): string | null {
  try {
    return fs.readFileSync(licensePath, 'utf-8');
  } catch {
    return null;
  }
}
