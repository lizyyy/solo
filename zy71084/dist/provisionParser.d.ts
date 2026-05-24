import { MobileProvision } from './types';
export declare class ProvisionParser {
    static parse(filePath: string): MobileProvision;
    private static extractPlistFromPKCS7;
    private static mapToMobileProvision;
    private static extractBundleId;
    static parseDirectory(directory: string): MobileProvision[];
    static parseFiles(paths: string[]): MobileProvision[];
}
