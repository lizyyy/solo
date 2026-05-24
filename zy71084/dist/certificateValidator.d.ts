import { CertificateInfo } from './types';
export declare class CertificateValidator {
    static parseFromFile(filePath: string, password?: string): CertificateInfo;
    private static parseP12;
    private static parseCer;
    private static parseX509Output;
    private static detectCertificateType;
    static getDaysUntilExpiration(cert: CertificateInfo): number;
    static isExpiringSoon(cert: CertificateInfo, days: number): boolean;
    static parseDirectory(directory: string, password?: string): CertificateInfo[];
    static parseFiles(paths: string[], password?: string): CertificateInfo[];
}
