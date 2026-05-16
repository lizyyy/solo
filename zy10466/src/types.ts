export interface LifecycleRule {
  id: string;
  status: 'Enabled' | 'Disabled';
  filter?: {
    prefix?: string;
    tags?: Array<{ key: string; value: string }>;
  };
  expiration?: {
    days?: number;
    date?: string;
  };
  noncurrentVersionExpiration?: {
    noncurrentDays?: number;
  };
  abortIncompleteMultipartUpload?: {
    daysAfterInitiation?: number;
  };
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  isLatest: boolean;
  versionId?: string;
  tags: Array<{ key: string; value: string }>;
  storageClass: string;
  isDeleteMarker?: boolean;
}

export interface ObjectWithSource extends StorageObject {
  source: {
    file: string;
    line: number;
    raw: string;
  };
}

export interface MatchResult {
  object: ObjectWithSource;
  matchedRules: Array<{
    rule: LifecycleRule;
    actionType: 'expiration' | 'noncurrentVersionExpiration' | 'abortIncompleteMultipartUpload';
    daysUntilAction: number;
    scheduledDate: Date;
  }>;
  willBeDeleted: boolean;
  earliestActionDate?: Date;
}

export interface BadRow {
  file: string;
  line: number;
  raw: string;
  error: string;
}

export interface SimulationResult {
  summary: {
    totalObjects: number;
    matchedObjects: number;
    objectsToDelete: number;
    totalSize: number;
    sizeToDelete: number;
    badRows: number;
  };
  matches: MatchResult[];
  badRows: BadRow[];
  rules: LifecycleRule[];
  simulationDate: Date;
}

export interface CliOptions {
  input: string;
  rules: string;
  output: string;
  simulationDate?: string;
  format: string;
  verbose: boolean;
  quiet: boolean;
}
