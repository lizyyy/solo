export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface TokenValue {
  value: string;
  type?: string;
  description?: string;
  filePath?: string;
  line?: number;
  column?: number;
}

export interface Token {
  name: string;
  path: string[];
  value: string;
  resolvedValue: string;
  type?: string;
  description?: string;
  isAlias: boolean;
  aliasChain?: string[];
  filePath?: string;
  line?: number;
  column?: number;
}

export interface ColorToken extends Token {
  rgba: RGBA;
  hex: string;
}

export interface TokenPair {
  id: string;
  foreground: ColorToken;
  background: ColorToken;
  context?: string;
  component?: string;
  variant?: string;
}

export interface ContrastResult {
  pair: TokenPair;
  contrastRatio: number;
  wcagLevel: {
    aaNormal: boolean;
    aaLarge: boolean;
    aaaNormal: boolean;
    aaaLarge: boolean;
  };
  passes: boolean;
  threshold: number;
  notes: string[];
  calculation: {
    foregroundHex: string;
    backgroundHex: string;
    foregroundWithAlphaBlend?: string;
    backgroundWithAlphaBlend?: string;
    luminanceForeground: number;
    luminanceBackground: number;
  };
}

export interface UnresolvedToken {
  name: string;
  value: string;
  reason: string;
  filePath?: string;
  line?: number;
  column?: number;
}

export interface CliOptions {
  tokens: string;
  pairs?: string;
  outputDir: string;
  threshold: number;
  mode: 'light' | 'dark' | 'both';
  formats: ('terminal' | 'json' | 'markdown')[];
  verbose: boolean;
  foreground?: string;
  background?: string;
}

export interface AnalysisReport {
  metadata: {
    generatedAt: string;
    version: string;
    options: CliOptions;
  };
  summary: {
    totalPairs: number;
    passed: number;
    failed: number;
    warning: number;
    passRate: number;
  };
  results: ContrastResult[];
  unresolvedTokens: UnresolvedToken[];
  tokenMap: Record<string, ColorToken>;
}

export interface ComponentUsage {
  component: string;
  variant?: string;
  foregroundToken: string;
  backgroundToken: string;
  context?: string;
}

export interface TokenFileSource {
  filePath: string;
  line: number;
  column: number;
}
