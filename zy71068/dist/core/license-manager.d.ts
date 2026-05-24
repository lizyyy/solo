import { LicenseEntry, FontFile, Risk, RiskLevel } from '../types.js';
export declare class LicenseManager {
    private entries;
    loadFromFile(filePath: string): Promise<LicenseEntry[]>;
    getEntries(): LicenseEntry[];
    matchFont(font: FontFile): LicenseEntry | null;
    matchFontFamily(familyName: string): LicenseEntry | null;
    checkLicenseValidity(entry: LicenseEntry, checkDate?: Date): {
        isValid: boolean;
        expiresIn?: number;
        expiredFor?: number;
    };
}
export declare class RiskAssessor {
    private risks;
    assessAll(fontFiles: FontFile[], licenses: LicenseEntry[], licenseManager: LicenseManager, remoteFontsCount: number, unmatchedReferences: {
        familyName: string;
    }[]): Risk[];
    private addRisk;
    private assessMissingLicenses;
    private assessExpiredLicenses;
    private assessRemoteFonts;
    private assessUnmatchedReferences;
    private assessVersionConflicts;
    getRisksByLevel(risks: Risk[]): Record<RiskLevel, Risk[]>;
    countRisksByLevel(risks: Risk[]): Record<RiskLevel, number>;
    shouldFail(risks: Risk[], failLevel: RiskLevel | null): boolean;
}
