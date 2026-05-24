import { MobileProvision, CertificateInfo, TargetConfig } from './types';
export interface MatchResult {
    isMatch: boolean;
    confidence: 'exact' | 'wildcard' | 'none';
    reason?: string;
}
export interface ProfileMatchResult extends MatchResult {
    profile: MobileProvision;
}
export interface CertificateMatchResult extends MatchResult {
    certificate: CertificateInfo;
}
export declare class BundleMatcher {
    static matchBundleId(profileBundleId: string, targetBundleId: string): MatchResult;
    private static matchWildcard;
    static findMatchingProfile(profiles: MobileProvision[], target: TargetConfig): ProfileMatchResult | null;
    private static isBetterMatch;
    static findMatchingCertificate(certificates: CertificateInfo[], profile: MobileProvision): CertificateMatchResult | null;
    static checkTeamConsistency(profile: MobileProvision, certificate: CertificateInfo): MatchResult;
    static detectWildcardIssues(profiles: MobileProvision[], targets: TargetConfig[]): Array<{
        target: TargetConfig;
        profile: MobileProvision;
        issue: string;
        suggestion: string;
    }>;
    static detectCrossTargetConflicts(targets: TargetConfig[], profiles: MobileProvision[]): Array<{
        targets: TargetConfig[];
        profile: MobileProvision;
        issue: string;
    }>;
}
