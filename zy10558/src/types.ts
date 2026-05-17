export interface TestFailure {
  id: string;
  testName: string;
  errorMessage: string;
  stackTrace: string;
  timestamp?: string;
  raw?: string;
  sourceLine?: number;
}

export interface NormalizedFailure {
  original: TestFailure;
  normalizedError: string;
  normalizedStack: string;
  features: string[];
  fingerprint: string;
}

export interface Cluster {
  id: string;
  label: string;
  failures: NormalizedFailure[];
  representative: NormalizedFailure;
  isNew?: boolean;
  frequency: number;
}

export interface Baseline {
  version: string;
  timestamp: string;
  fingerprints: string[];
  clusters: {
    fingerprint: string;
    label: string;
    count: number;
  }[];
}

export interface ParseResult {
  successes: TestFailure[];
  errors: {
    line: number;
    content: string;
    reason: string;
  }[];
}

export interface ClusterResult {
  totalFailures: number;
  totalClusters: number;
  newFailures: number;
  existingFailures: number;
  clusters: Cluster[];
  parseErrors: ParseResult['errors'];
  baseline?: Baseline;
  generatedAt: string;
}
