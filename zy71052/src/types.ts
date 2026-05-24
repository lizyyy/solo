export interface CLIOptions {
  openapi: string;
  logs: string;
  clients: string;
  owners: string;
  output: string;
  format: OutputFormat[];
  deprecationDate?: string;
  timezone: string;
  overwrite: boolean;
  append: boolean;
  verbose: boolean;
}

export type OutputFormat = 'json' | 'markdown' | 'terminal';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface DeprecatedRoute {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  deprecationDate?: string;
  sunsetDate?: string;
  replacement?: string;
  xDeprecation?: {
    date?: string;
    reason?: string;
    replacement?: string;
  };
  pathAliases: string[];
}

export interface ParsedOpenAPI {
  title: string;
  version: string;
  deprecatedRoutes: DeprecatedRoute[];
  allRoutes: number;
}

export interface GatewayLogEntry {
  timestamp: string;
  clientId: string;
  clientVersion?: string;
  path: string;
  method: string;
  statusCode: number;
  userAgent?: string;
  requestId?: string;
}

export interface ClientInfo {
  clientId: string;
  name: string;
  owner: string;
  department?: string;
  versions: string[];
  isInternal: boolean;
}

export interface OwnerInfo {
  name: string;
  email: string;
  slack?: string;
  department?: string;
}

export interface RouteMatchResult {
  route: DeprecatedRoute;
  matchedPath: string;
  isAlias: boolean;
}

export interface ClientUsage {
  clientId: string;
  clientName: string;
  versions: Record<string, {
    count: number;
    lastUsed: string;
  }>;
  routes: {
    path: string;
    method: string;
    count: number;
    lastUsed: string;
  }[];
  totalRequests: number;
  owner?: OwnerInfo;
  riskLevel: RiskLevel;
}

export interface InspectionResult {
  metadata: {
    inspectionDate: string;
    openapiFile: string;
    logFile: string;
    clientFile: string;
    ownerFile: string;
    timezone: string;
    reportId: string;
  };
  summary: {
    totalDeprecatedRoutes: number;
    activeDeprecatedRoutes: number;
    affectedClients: number;
    totalDeprecatedRequests: number;
    criticalRiskClients: number;
    highRiskClients: number;
    mediumRiskClients: number;
    lowRiskClients: number;
  };
  deprecatedRoutes: DeprecatedRoute[];
  clientUsages: ClientUsage[];
  unmatchedRoutes: {
    path: string;
    method: string;
    count: number;
  }[];
  unmatchedClients: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ExitCodes {
  SUCCESS: number;
  VALIDATION_ERROR: number;
  INPUT_ERROR: number;
  PROCESSING_ERROR: number;
  CRITICAL_RISK_FOUND: number;
}

export const EXIT_CODES: ExitCodes = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  INPUT_ERROR: 2,
  PROCESSING_ERROR: 3,
  CRITICAL_RISK_FOUND: 4,
};
