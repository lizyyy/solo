export interface AnchorInfo {
  name: string;
  path: string;
  value: any;
  referencedBy: string[];
  sourceType: 'anchor' | 'alias';
}

export interface MergeKeyInfo {
  path: string;
  sources: string[];
  mergedKeys: string[];
}

export interface OverrideInfo {
  path: string;
  oldValue: any;
  newValue: any;
  source: string;
  order: number;
}

export interface ExpansionContext {
  anchors: Map<string, AnchorInfo>;
  mergeKeys: MergeKeyInfo[];
  overrides: OverrideInfo[];
  visitedPaths: Set<string>;
  currentPath: string;
  cycleDetection: Set<string>;
}

export interface ExpansionResult {
  expanded: any;
  original: any;
  anchors: AnchorInfo[];
  mergeKeys: MergeKeyInfo[];
  overrides: OverrideInfo[];
  warnings: string[];
  errors: string[];
  cycleDetected: boolean;
}

export interface CliOptions {
  input: string;
  output?: string;
  outputDir?: string;
  env?: string[];
  keyPath?: string;
  format: ('terminal' | 'json' | 'markdown' | 'all')[];
  verbose: boolean;
  quiet: boolean;
}

export interface ReportData {
  meta: {
    inputFile: string;
    timestamp: string;
    version: string;
  };
  summary: {
    totalAnchors: number;
    totalAliases: number;
    totalMergeKeys: number;
    totalOverrides: number;
    warnings: number;
    errors: number;
    hasCycle: boolean;
  };
  anchors: AnchorInfo[];
  mergeKeys: MergeKeyInfo[];
  overrides: OverrideInfo[];
  expandedYaml: string;
  originalYaml: string;
  diff?: string;
}

export interface SelfTestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}
