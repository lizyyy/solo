import { RiskLevel, CheckResult, WidthCalculationResult, PlaceholderIssue } from './types';
export interface RiskAssessment {
    level: RiskLevel;
    explanation: string;
}
export declare function assessRisk(widthResult: WidthCalculationResult, maxWidth: number, placeholderIssues: PlaceholderIssue[], maxChars?: number): RiskAssessment;
export declare function getRiskLevelColor(level: RiskLevel): string;
export declare function getRiskLevelEmoji(level: RiskLevel): string;
export declare function getRiskLevelLabel(level: RiskLevel): string;
export declare function sortResultsByRisk(results: CheckResult[]): CheckResult[];
export declare function filterResultsByRisk(results: CheckResult[], minLevel: RiskLevel): CheckResult[];
