export interface PackageInfo {
  name: string;
  version: string;
  license: string | null;
  licenseFile?: string;
  licenseText?: string;
  path: string;
  isWorkspace: boolean;
  isPrivate: boolean;
  dependencies: string[];
}

export interface LicenseInfo {
  name: string;
  spdxId: string | null;
  isValid: boolean;
  isDual: boolean;
  alternatives: string[];
}

export interface ExceptionItem {
  name: string;
  version?: string;
  reason: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ComplianceOptions {
  allowedLicenses: string[];
  exceptions: ExceptionItem[];
  warnOnMissingLicense: boolean;
  failOnViolation: boolean;
}

export interface CliOptions {
  cwd: string;
  outputDir: string;
  includeWorkspace: boolean;
  includePrivate: boolean;
  exceptionsFile?: string;
  allowedLicenses?: string[];
  format: string[];
  verbose: boolean;
  failOnViolation: boolean;
}

export interface LicenseReport {
  summary: {
    totalPackages: number;
    workspacePackages: number;
    externalPackages: number;
    privatePackages: number;
    packagesWithLicense: number;
    packagesMissingLicense: number;
    dualLicensePackages: number;
    violations: number;
    exceptions: number;
  };
  packages: PackageInfo[];
  violations: Violation[];
  exceptions: ExceptionItem[];
  exitCode: number;
  exitCodeDescription: string;
  generatedAt: string;
  cliVersion: string;
}

export interface Violation {
  packageName: string;
  packageVersion: string;
  type: 'unallowed_license' | 'missing_license' | 'unknown_license';
  license: string | null;
  severity: 'error' | 'warning';
  message: string;
}

export const ExitCodes = {
  SUCCESS: 0,
  VIOLATIONS: 1,
  INPUT_ERROR: 2,
  IO_ERROR: 3,
  PARSE_ERROR: 4,
} as const;

export type ExitCode = typeof ExitCodes[keyof typeof ExitCodes];
