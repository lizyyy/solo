export interface FontConfig {
  name: string;
  family: string;
  path: string;
  isVariable?: boolean;
  variableAxes?: VariableAxis[];
  supportedScripts?: string[];
  weight?: number;
  style?: string;
}

export interface VariableAxis {
  tag: string;
  name: string;
  min: number;
  max: number;
  default: number;
}

export interface SampleEntry {
  id: string;
  language: string;
  script: string;
  text: string;
  description?: string;
}

export interface FallbackChain {
  language: string;
  script: string;
  fonts: string[];
}

export interface FallbackConfig {
  defaults: {
    baseFonts: string[];
    emojiFont?: string;
  };
  chains: FallbackChain[];
}

export interface SubsetDefinition {
  name: string;
  unicodeRanges: UnicodeRange[];
  description?: string;
}

export interface UnicodeRange {
  start: number;
  end: number;
  name?: string;
}

export interface ParsedData {
  fonts: Map<string, FontConfig>;
  samples: SampleEntry[];
  fallbackConfig: FallbackConfig;
  subsets: Map<string, SubsetDefinition>;
}

export interface GlyphCheckResult {
  codePoint: number;
  char: string;
  language: string;
  script: string;
  sampleId: string;
  sampleText: string;
  fallbackChain: string[];
  missingInFonts: string[];
  isMissing: boolean;
}

export interface EmojiRisk {
  codePoint: number;
  char: string;
  sampleId: string;
  sampleText: string;
  riskType: 'directionality' | 'color' | 'missing';
  description: string;
}

export interface ArabicDirectionalityRisk {
  sampleId: string;
  sampleText: string;
  mixedDirection: boolean;
  hasNeutralChars: boolean;
  description: string;
  context: string;
}

export interface VariableAxisIssue {
  fontName: string;
  axisTag: string;
  axisName: string;
  requestedValue: number;
  minValue: number;
  maxValue: number;
  issueType: 'underflow' | 'overflow';
}

export interface UnusedSubset {
  subsetName: string;
  subsetDefinition: SubsetDefinition;
  reason: string;
}

export interface ValidationError {
  type: 'font' | 'sample' | 'fallback' | 'subset' | 'general';
  source: string;
  message: string;
  detail?: string;
}

export interface RuleResult<T> {
  name: string;
  description: string;
  passed: boolean;
  issues: T[];
}

export interface FontReport {
  summary: {
    totalSamples: number;
    totalFonts: number;
    totalSubsets: number;
    passedRules: number;
    failedRules: number;
    missingGlyphsCount: number;
    emojiRisksCount: number;
    arabicRisksCount: number;
    variableAxisIssuesCount: number;
    unusedSubsetsCount: number;
  };
  glyphChecks: RuleResult<GlyphCheckResult>;
  emojiChecks: RuleResult<EmojiRisk>;
  arabicChecks: RuleResult<ArabicDirectionalityRisk>;
  variableAxisChecks: RuleResult<VariableAxisIssue>;
  subsetChecks: RuleResult<UnusedSubset>;
  validationErrors: ValidationError[];
}
