import { MobileProvision, CertificateInfo, TargetConfig, CheckOptions, ProfileCheckResult, CertificateCheckResult, TargetCheckResult, CheckReport } from './types';
export declare class CheckEngine {
    static checkProfile(profile: MobileProvision, options: CheckOptions): ProfileCheckResult;
    private static checkProfileExpiration;
    private static checkProfileBundleId;
    private static checkProfileTeamInfo;
    private static checkProfileCertificates;
    static checkCertificate(certificate: CertificateInfo, options: CheckOptions): CertificateCheckResult;
    private static checkCertificateExpiration;
    private static checkCertificateValidity;
    private static checkCertificateType;
    private static checkCertificateTeamInfo;
    static checkTarget(target: TargetConfig, profiles: MobileProvision[], certificates: CertificateInfo[], options: CheckOptions): TargetCheckResult;
    private static checkTargetBundleId;
    static runFullCheck(profiles: MobileProvision[], certificates: CertificateInfo[], targets: TargetConfig[], options: CheckOptions): CheckReport;
    private static getOverallStatus;
}
