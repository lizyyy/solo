export interface ServerBlock {
  file: string;
  line: number;
  serverNames: string[];
  sslCertificate?: string;
  sslCertificateKey?: string;
  listen: string[];
  rawContent: string;
}

export interface ParseError {
  file: string;
  line: number;
  content: string;
  reason: string;
}

export interface CertInfo {
  path: string;
  exists: boolean;
  isValid: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: Date;
  validTo?: Date;
  daysUntilExpiry?: number;
  domains: string[];
  error?: string;
}

export interface DomainCertMap {
  domain: string;
  certPath?: string;
  keyPath?: string;
  certInfo?: CertInfo;
  serverBlocks: {
    file: string;
    line: number;
  }[];
}

export interface MissingReference {
  type: 'cert' | 'key' | 'both';
  domain: string;
  serverBlock: {
    file: string;
    line: number;
  };
}

export interface ScanResult {
  scanTime: Date;
  inputDir: string;
  outputDir: string;
  serverBlocks: ServerBlock[];
  parseErrors: ParseError[];
  certInfos: Map<string, CertInfo>;
  domainCertMaps: DomainCertMap[];
  missingReferences: MissingReference[];
  summary: {
    totalServers: number;
    totalDomains: number;
    totalCerts: number;
    expiringIn30Days: number;
    expiringIn7Days: number;
    expired: number;
    missingCerts: number;
    parseErrors: number;
  };
}

export interface ReportOptions {
  outputDir: string;
  timestamp: string;
}
