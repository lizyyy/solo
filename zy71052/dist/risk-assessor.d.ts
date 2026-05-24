import { RiskLevel, ClientUsage, DeprecatedRoute } from './types';
export interface RiskFactors {
    totalRequests: number;
    daysUntilDeprecation: number;
    isDeprecationExpired: boolean;
    activeVersions: number;
    routeCount: number;
    isInternalClient: boolean;
    lastUsedDays: number;
}
export interface RiskAssessment {
    level: RiskLevel;
    score: number;
    factors: RiskFactors;
    reasons: string[];
}
export declare function calculateRiskLevel(clientUsage: ClientUsage, routes: DeprecatedRoute[], timezone: string, isInternalClient?: boolean): RiskAssessment;
export declare function getRiskLevelLabel(level: RiskLevel): string;
export declare function getRiskLevelEmoji(level: RiskLevel): string;
export declare function sortByRiskLevel<T>(items: T[], getLevel: (item: T) => RiskLevel): T[];
