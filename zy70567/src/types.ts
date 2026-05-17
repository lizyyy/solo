export interface IpRangeEntry {
  lineNumber: number;
  cidr: string;
  team: string;
  purpose: string;
  environment: string;
  startIp: bigint;
  endIp: bigint;
}

export interface BadEntry {
  lineNumber: number;
  rawContent: string;
  reason: string;
}

export interface OverlapPair {
  entry1: IpRangeEntry;
  entry2: IpRangeEntry;
  overlapStart: bigint;
  overlapEnd: bigint;
  overlapCidr: string;
}

export interface TeamSummary {
  team: string;
  totalRanges: number;
  environments: string[];
  purposes: string[];
  overlappingCount: number;
}

export interface AnalysisResult {
  totalEntries: number;
  validEntries: number;
  badEntries: BadEntry[];
  overlappingPairs: OverlapPair[];
  teamSummaries: TeamSummary[];
  environmentSummaries: Record<string, number>;
}

export interface CliOptions {
  input: string;
  outputJson?: string;
  outputMd?: string;
}
