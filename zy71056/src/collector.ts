import * as fs from 'fs';
import * as path from 'path';
import { PackageInfo, LicenseReport, Violation, ExceptionItem, ExitCodes, CliOptions } from './types';
import { parseLockfile, LockfilePackage } from './lockfile-parser';
import { detectWorkspacePackages, WorkspacePackage, findLicenseFile, readLicenseText } from './workspace-detector';
import { parseLicense, isLicenseAllowed } from './license-parser';
import { loadExceptions, isPackageExcepted } from './exceptions';
import { describeExitCode } from './exit-codes';
import { version } from '../package.json';

export interface CollectorResult {
  report: LicenseReport;
  exitCode: number;
}

export async function collectLicenses(options: CliOptions): Promise<CollectorResult> {
  const cwd = path.resolve(options.cwd);

  if (!fs.existsSync(cwd)) {
    throw new Error(`工作目录不存在: ${cwd}`);
  }

  const lockfilePackages = parseLockfile(cwd);
  const workspacePackages = await detectWorkspacePackages(cwd);
  const exceptions = options.exceptionsFile ? loadExceptions(options.exceptionsFile) : [];

  const allPackages = await collectAllPackages(
    lockfilePackages,
    workspacePackages,
    cwd,
    options
  );

  const { violations, activeExceptions } = checkCompliance(
    allPackages,
    options.allowedLicenses || [],
    exceptions
  );

  const finalPackages = options.includePrivate
    ? allPackages
    : allPackages.filter(p => !p.isPrivate);

  const summary = calculateSummary(finalPackages, violations, activeExceptions);

  const exitCode = determineExitCode(violations, options.failOnViolation);

  const report: LicenseReport = {
    summary,
    packages: finalPackages,
    violations,
    exceptions: activeExceptions,
    exitCode,
    exitCodeDescription: describeExitCode(exitCode as any),
    generatedAt: new Date().toISOString(),
    cliVersion: version,
  };

  return { report, exitCode };
}

async function collectAllPackages(
  lockfilePackages: Map<string, LockfilePackage>,
  workspacePackages: Map<string, WorkspacePackage>,
  cwd: string,
  options: CliOptions
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];
  const seen = new Set<string>();

  for (const wsPkg of workspacePackages.values()) {
    const key = `${wsPkg.name}@${wsPkg.version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const licenseFile = findLicenseFile(wsPkg.path);
    packages.push({
      name: wsPkg.name,
      version: wsPkg.version,
      license: wsPkg.license,
      licenseFile: licenseFile || undefined,
      licenseText: licenseFile ? readLicenseText(licenseFile) || undefined : undefined,
      path: wsPkg.path,
      isWorkspace: true,
      isPrivate: wsPkg.isPrivate,
      dependencies: [],
    });
  }

  for (const [key, lockPkg] of lockfilePackages.entries()) {
    if (workspacePackages.has(lockPkg.name)) {
      continue;
    }

    if (seen.has(key)) continue;
    seen.add(key);

    const pkgPath = path.join(cwd, 'node_modules', lockPkg.name);
    const pkgJsonPath = path.join(pkgPath, 'package.json');

    let license: string | null = lockPkg.license || null;
    let isPrivate = false;
    let licenseFile: string | undefined;
    let licenseText: string | undefined;

    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        license = pkgJson.license || license;
        isPrivate = !!pkgJson.private;

        const foundLicense = findLicenseFile(pkgPath);
        if (foundLicense) {
          licenseFile = foundLicense;
          licenseText = readLicenseText(foundLicense) || undefined;
        }
      } catch {
      }
    }

    packages.push({
      name: lockPkg.name,
      version: lockPkg.version,
      license,
      licenseFile,
      licenseText,
      path: pkgPath,
      isWorkspace: false,
      isPrivate,
      dependencies: Object.keys(lockPkg.dependencies || {}),
    });
  }

  return packages;
}

function checkCompliance(
  packages: PackageInfo[],
  allowedLicenses: string[],
  exceptions: ExceptionItem[]
): { violations: Violation[]; activeExceptions: ExceptionItem[] } {
  const violations: Violation[] = [];
  const activeExceptions: ExceptionItem[] = [];

  if (allowedLicenses.length === 0) {
    return { violations, activeExceptions };
  }

  for (const pkg of packages) {
    if (pkg.isWorkspace) continue;

    const excepted = isPackageExcepted(pkg.name, pkg.version, exceptions);
    if (excepted) {
      activeExceptions.push(excepted);
      continue;
    }

    if (!pkg.license) {
      violations.push({
        packageName: pkg.name,
        packageVersion: pkg.version,
        type: 'missing_license',
        license: null,
        severity: 'warning',
        message: '缺失许可证信息',
      });
      continue;
    }

    const licenseInfo = parseLicense(pkg.license);

    if (!licenseInfo.isValid) {
      violations.push({
        packageName: pkg.name,
        packageVersion: pkg.version,
        type: 'unknown_license',
        license: pkg.license,
        severity: 'warning',
        message: `未知许可证格式: ${pkg.license}`,
      });
      continue;
    }

    if (!isLicenseAllowed(licenseInfo, allowedLicenses)) {
      violations.push({
        packageName: pkg.name,
        packageVersion: pkg.version,
        type: 'unallowed_license',
        license: pkg.license,
        severity: 'error',
        message: `许可证 ${pkg.license} 不在允许列表中`,
      });
    }
  }

  return { violations, activeExceptions };
}

function calculateSummary(
  packages: PackageInfo[],
  violations: Violation[],
  exceptions: ExceptionItem[]
): LicenseReport['summary'] {
  const workspacePackages = packages.filter(p => p.isWorkspace);
  const externalPackages = packages.filter(p => !p.isWorkspace);
  const privatePackages = packages.filter(p => p.isPrivate);
  const packagesWithLicense = packages.filter(p => p.license);
  const packagesMissingLicense = packages.filter(p => !p.license);

  let dualLicenseCount = 0;
  for (const pkg of packages) {
    if (pkg.license) {
      const info = parseLicense(pkg.license);
      if (info.isDual) dualLicenseCount++;
    }
  }

  return {
    totalPackages: packages.length,
    workspacePackages: workspacePackages.length,
    externalPackages: externalPackages.length,
    privatePackages: privatePackages.length,
    packagesWithLicense: packagesWithLicense.length,
    packagesMissingLicense: packagesMissingLicense.length,
    dualLicensePackages: dualLicenseCount,
    violations: violations.length,
    exceptions: exceptions.length,
  };
}

function determineExitCode(violations: Violation[], failOnViolation: boolean): number {
  if (violations.length === 0) {
    return ExitCodes.SUCCESS;
  }

  const hasErrors = violations.some(v => v.severity === 'error');

  if (failOnViolation && hasErrors) {
    return ExitCodes.VIOLATIONS;
  }

  return ExitCodes.SUCCESS;
}
