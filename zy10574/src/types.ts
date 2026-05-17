export interface PackageEngines {
  node?: string;
  npm?: string;
  yarn?: string;
  pnpm?: string;
}

export interface PackageInfo {
  name: string;
  version: string;
  engines?: PackageEngines;
  path: string;
  isRoot: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface LockfileEntry {
  name: string;
  version: string;
  engines?: PackageEngines;
  path: string;
}

export interface CIConfig {
  type: 'github-actions' | 'gitlab-ci' | 'circleci' | 'jenkins' | 'unknown';
  path: string;
  nodeVersions: string[];
  rawContent: string;
}

export interface VersionRange {
  raw: string;
  minVersion: string | null;
  maxVersion: string | null;
  isValid: boolean;
  parseError?: string;
}

export interface VersionRequirement {
  packageName: string;
  packagePath: string;
  range: VersionRange;
  source: 'engines' | 'lockfile' | 'ci' | 'package-manager';
}

export interface VersionConflict {
  type: 'range-conflict' | 'ci-mismatch' | 'invalid-range' | 'unspecified';
  packages: string[];
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface AnomalySample {
  id: string;
  type: string;
  location: {
    file: string;
    line?: number;
    column?: number;
    raw?: string;
  };
  message: string;
  cause: string;
  context?: Record<string, unknown>;
}

export interface VersionMatrix {
  allVersions: string[];
  recommendedVersions: string[];
  compatiblePackages: Map<string, string[]>;
  conflicts: VersionConflict[];
  anomalies: AnomalySample[];
}

export interface ScanResult {
  packages: PackageInfo[];
  lockfileEntries: LockfileEntry[];
  ciConfigs: CIConfig[];
  requirements: VersionRequirement[];
  anomalies: AnomalySample[];
}

export interface MatrixReport {
  metadata: {
    scanTime: string;
    rootPath: string;
    totalPackages: number;
    totalRequirements: number;
  };
  matrix: VersionMatrix;
  summary: {
    totalConflicts: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    anomalyCount: number;
  };
  recommendations: string[];
}

export interface CLIOptions {
  path: string;
  output?: string;
  format: 'terminal' | 'json' | 'markdown' | 'all';
  ci?: string;
  strict: boolean;
  includeDev: boolean;
  depth: number;
}
