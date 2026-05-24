export interface MobileProvision {
  filePath: string;
  name: string;
  uuid: string;
  bundleId: string;
  teamId: string;
  teamName: string;
  expirationDate: Date;
  creationDate: Date;
  applicationIdentifier: string;
  entitlements: Record<string, any>;
  developerCertificates: string[];
  provisionsAllDevices?: boolean;
  provisionedDevices?: string[];
}

export interface CertificateInfo {
  filePath: string;
  name: string;
  commonName: string;
  teamId: string;
  teamName: string;
  serialNumber: string;
  fingerprint: string;
  notBefore: Date;
  notAfter: Date;
  isValid: boolean;
  isExpired: boolean;
  type: 'development' | 'distribution' | 'unknown';
}

export interface TargetConfig {
  name: string;
  bundleId: string;
  profileName?: string;
  certificateName?: string;
  source: string;
  lineNumber: number;
}

export interface CheckOptions {
  profiles: string[];
  certificates: string[];
  targets: TargetConfig[];
  bundleIds?: string[];
  outputDir: string;
  warnDaysBeforeExpiration: number;
  strictMode: boolean;
}

export enum CheckStatus {
  PASS = 'PASS',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SKIP = 'SKIP'
}

export interface CheckResultItem {
  checkName: string;
  status: CheckStatus;
  message: string;
  details?: string;
  location?: {
    file: string;
    line?: number;
  };
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ProfileCheckResult {
  profile: MobileProvision;
  checks: CheckResultItem[];
  overallStatus: CheckStatus;
}

export interface CertificateCheckResult {
  certificate: CertificateInfo;
  checks: CheckResultItem[];
  overallStatus: CheckStatus;
}

export interface TargetCheckResult {
  target: TargetConfig;
  matchedProfile?: MobileProvision;
  matchedCertificate?: CertificateInfo;
  checks: CheckResultItem[];
  overallStatus: CheckStatus;
}

export interface CheckReport {
  generatedAt: Date;
  options: CheckOptions;
  profiles: ProfileCheckResult[];
  certificates: CertificateCheckResult[];
  targets: TargetCheckResult[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
    skipped: number;
  };
  exitCode: number;
}

export interface OutputFormats {
  terminal: boolean;
  json: boolean;
  markdown: boolean;
}
