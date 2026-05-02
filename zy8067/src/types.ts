export interface PluginManifest {
  name: string;
  version: string;
  platformVersion: string;
  hooks: HookDefinition[];
}

export interface HookDefinition {
  id: string;
  entry: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  timeout?: number;
}

export interface Fixture {
  name: string;
  hookId: string;
  input: any;
  expectedOutput?: any;
}

export interface Policy {
  forbiddenAPIs: string[];
  maxExecutionTime: number;
  allowedGlobals: string[];
}

export interface HookExecutionResult {
  hookId: string;
  fixtureName: string;
  success: boolean;
  output?: any;
  error?: string;
  duration: number;
  timedOut: boolean;
  sideEffectsDetected: boolean;
  inputValid: boolean;
  outputValid: boolean;
  versionCompatible: boolean;
}

export interface CompatibilityReport {
  plugin: {
    name: string;
    version: string;
    platformVersion: string;
  };
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: HookExecutionResult[];
}