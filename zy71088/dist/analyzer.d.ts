import { FlagDefinition, FlagMatch, FlagAnalysis, RiskLevel, ScanOptions, AnalysisResult } from './types';
export declare function detectDefaultValueInversion(flag: FlagDefinition, matches: FlagMatch[], assumedDefault?: boolean): {
    inverted: boolean;
    reason: string;
};
export declare function detectDynamicNameUsage(flag: FlagDefinition, matches: FlagMatch[]): boolean;
export declare function calculateRiskLevel(flag: FlagDefinition, matches: FlagMatch[], analysis: {
    defaultValueInverted: boolean;
    dynamicNameUsed: boolean;
}): {
    level: RiskLevel;
    reasons: string[];
};
export declare function generateRecommendation(flag: FlagDefinition, riskLevel: RiskLevel, matchCount: number): string;
export declare function canRemoveFlag(flag: FlagDefinition, riskLevel: RiskLevel, matchCount: number): boolean;
export declare function analyzeFlag(flag: FlagDefinition, allMatches: FlagMatch[], options: ScanOptions): FlagAnalysis;
export declare function analyzeAllFlags(flagDefinitions: FlagDefinition[], matches: FlagMatch[], options: ScanOptions, filesScanned: string[], errors: string[], startTime: number): AnalysisResult;
