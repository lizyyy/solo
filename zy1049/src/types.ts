export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  permissions: Permission[];
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export type Permission = 
  | 'fs:read'
  | 'fs:write'
  | 'fs:delete'
  | 'network:fetch'
  | 'network:http'
  | 'env:read'
  | 'env:write'
  | 'event:subscribe'
  | 'event:publish'
  | 'process:spawn'
  | 'process:exec';

export interface PermissionScope {
  permission: Permission;
  allowedPaths?: string[];
  allowedUrls?: string[];
  allowedEnvs?: string[];
  allowedEvents?: string[];
}

export interface PluginInfo {
  name: string;
  version: string;
  path: string;
  manifestPath: string;
  mainPath: string;
  manifest: PluginManifest;
  manifestValid: boolean;
  validationErrors: string[];
}

export interface SandboxContext {
  pluginName: string;
  runId: string;
  startTime: number;
  timeout: number;
  declaredPermissions: Permission[];
}

export interface CapabilityCall {
  timestamp: number;
  capability: Permission;
  method: string;
  args: unknown[];
  success: boolean;
  error?: string;
  stack?: string;
}

export interface EventRecord {
  timestamp: number;
  type: 'subscribe' | 'publish' | 'emit';
  eventName: string;
  data?: unknown;
}

export interface PluginRunResult {
  pluginName: string;
  runId: string;
  success: boolean;
  exitCode: number;
  startTime: number;
  endTime: number;
  duration: number;
  timeout: boolean;
  crashed: boolean;
  errorMessage?: string;
  errorStack?: string;
  capabilityCalls: CapabilityCall[];
  events: EventRecord[];
  consoleOutput: string[];
}

export interface AuditFinding {
  type: 'violation' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  details?: Record<string, unknown>;
  capability?: Permission;
  timestamp?: number;
}

export interface PermissionAudit {
  permission: Permission;
  declared: boolean;
  used: boolean;
  callCount: number;
  calls: CapabilityCall[];
  status: 'declared_used' | 'declared_unused' | 'undeclared_used';
}

export interface PluginAuditReport {
  runId: string;
  generatedAt: number;
  pluginName: string;
  pluginVersion: string;
  manifest: PluginManifest;
  
  runSummary: {
    success: boolean;
    crashed: boolean;
    timeout: boolean;
    startTime: number;
    endTime: number;
    duration: number;
    errorMessage?: string;
  };
  
  permissionAudits: PermissionAudit[];
  
  statistics: {
    totalCapabilityCalls: number;
    declaredUsed: number;
    declaredUnused: number;
    undeclaredUsed: number;
    eventsPublished: number;
    eventsSubscribed: number;
  };
  
  findings: AuditFinding[];
  
  capabilityCalls: CapabilityCall[];
  events: EventRecord[];
  consoleOutput: string[];
}

export interface BatchAuditReport {
  runId: string;
  generatedAt: number;
  pluginsCount: number;
  plugins: PluginAuditReport[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    crashed: number;
    timeout: number;
    violations: number;
    warnings: number;
  };
}

export interface RunConfig {
  pluginsDir: string;
  outputDir: string;
  timeout: number;
  verbose: boolean;
  dryRun: boolean;
  serveReport: boolean;
  servePort: number;
}
