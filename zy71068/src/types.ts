export type FontFormat = 'woff2' | 'woff' | 'ttf' | 'otf' | 'eot' | 'svg';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ReferenceSource = 'css' | 'html' | 'scss' | 'inline';

export interface FontFile {
  id: string;
  path: string;
  fileName: string;
  familyName: string;
  format: FontFormat;
  size: number;
  lastModified: Date;
  version?: string;
  weight?: string;
  style?: string;
}

export interface FontReference {
  id: string;
  source: ReferenceSource;
  sourcePath: string;
  familyName: string;
  urls: string[];
  formats: FontFormat[];
  isRemote: boolean;
  weight?: string;
  style?: string;
  lineNumber?: number;
}

export interface LicenseEntry {
  id: string;
  familyName: string;
  alternativeNames: string[];
  licenseType: string;
  version?: string;
  validFrom?: Date;
  validUntil?: Date;
  permittedUses: string[];
  restrictions: string[];
  sourceUrl?: string;
  attribution?: string;
}

export interface Risk {
  id: string;
  level: RiskLevel;
  category: string;
  message: string;
  fontId?: string;
  details: Record<string, unknown>;
}

export interface AuditConfig {
  projectDir: string;
  licenseFile?: string;
  outputDir: string;
  includeRemote: boolean;
  failOnRisk: RiskLevel | null;
  customExtensions: string[];
}

export interface AuditResult {
  metadata: {
    timestamp: Date;
    version: string;
    projectDir: string;
  };
  fonts: {
    files: FontFile[];
    references: FontReference[];
    unmatchedReferences: FontReference[];
  };
  licenses: {
    entries: LicenseEntry[];
    matched: Map<string, LicenseEntry>;
    missing: string[];
  };
  risks: Risk[];
  summary: {
    totalFontFiles: number;
    totalReferences: number;
    totalLicenses: number;
    missingLicenses: number;
    risksByLevel: Record<RiskLevel, number>;
    remoteFonts: number;
    versionConflicts: number;
    expiredLicenses: number;
  };
}

export interface ExitCodes {
  SUCCESS: number;
  INPUT_ERROR: number;
  CONFIG_ERROR: number;
  RISK_DETECTED: number;
  SCAN_ERROR: number;
  TEST_FAILED: number;
}

export const EXIT_CODES: ExitCodes = {
  SUCCESS: 0,
  INPUT_ERROR: 1,
  CONFIG_ERROR: 2,
  RISK_DETECTED: 3,
  SCAN_ERROR: 4,
  TEST_FAILED: 5,
};
