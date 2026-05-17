export interface ProxyConfig {
  trustedProxies: string[];
  trustDepth: number;
  trustedHeaders: string[];
}

export interface RequestSample {
  id: string;
  lineNumber: number;
  raw: string;
  headers: Record<string, string>;
  expectedProtocol?: string;
  expectedIp?: string;
}

export interface HeaderChain {
  xForwardedFor: string[];
  xForwardedProto: string[];
  xForwardedHost: string[];
  xForwardedPort: string[];
}

export interface Anomaly {
  type: 'ip_mismatch' | 'protocol_mismatch' | 'suspicious_header' | 'invalid_format' | 'untrusted_proxy';
  header: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CheckResult {
  sample: RequestSample;
  headerChain: HeaderChain;
  realIp: string;
  realProtocol: string;
  anomalies: Anomaly[];
  isNormal: boolean;
  trustedProxyCount: number;
}

export interface ReportData {
  summary: {
    total: number;
    normal: number;
    abnormal: number;
    anomalyCount: number;
  };
  results: CheckResult[];
  config: ProxyConfig;
  generatedAt: string;
}

export interface OutputOptions {
  terminal: boolean;
  json?: string;
  html?: string;
  keepBadLines: boolean;
}
