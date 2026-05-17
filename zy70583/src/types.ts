export interface Alert {
  id: string;
  ruleName: string;
  ruleId: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  fingerprint?: string;
}

export interface Rule {
  id: string;
  name: string;
  expr: string;
  severity: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface Silence {
  id: string;
  comment: string;
  createdBy: string;
  startsAt: number;
  endsAt: number;
  matchers: SilenceMatcher[];
  status: 'active' | 'pending' | 'expired';
}

export interface SilenceMatcher {
  name: string;
  value: string;
  isRegex: boolean;
  isEqual: boolean;
}

export interface AlertAggregation {
  ruleId: string;
  ruleName: string;
  totalCount: number;
  severity: string;
  uniqueFingerprints: number;
  firstSeen: number;
  lastSeen: number;
  labels: Record<string, string[]>;
}

export interface NoiseScore {
  ruleId: string;
  ruleName: string;
  totalScore: number;
  factors: NoiseFactor[];
  recommendation: 'review' | 'tune' | 'silence' | 'keep';
  confidence: number;
}

export interface NoiseFactor {
  name: string;
  score: number;
  description: string;
  weight: number;
}

export interface MatchResult {
  silenceId: string;
  silenceComment: string;
  matchedBy: string[];
  matchedAlertCount: number;
}

export interface DenoiseResult {
  metadata: {
    generatedAt: number;
    inputFiles: {
      alerts?: string;
      rules?: string;
      silences?: string;
    };
    totalAlerts: number;
    totalRules: number;
    totalSilences: number;
  };
  aggregations: AlertAggregation[];
  noiseScores: NoiseScore[];
  matchedSilences: {
    ruleId: string;
    ruleName: string;
    matches: MatchResult[];
  }[];
  candidates: DenoiseCandidate[];
  parseErrors: ParseError[];
}

export interface DenoiseCandidate {
  type: 'silence' | 'rule_tune' | 'label_adjust';
  ruleId: string;
  ruleName: string;
  suggestion: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ParseError {
  file: string;
  lineNumber?: number;
  rawContent?: string;
  error: string;
  timestamp: number;
}

export interface CliOptions {
  alerts?: string;
  rules?: string;
  silences?: string;
  output?: string;
  format: 'json' | 'markdown' | 'terminal' | 'all';
  threshold: number;
  selfTest?: boolean;
}