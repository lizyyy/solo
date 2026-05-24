import { LicenseInfo } from './types';
export declare function parseLicense(licenseStr: string | null | undefined): LicenseInfo;
export declare function isLicenseAllowed(licenseInfo: LicenseInfo, allowedLicenses: string[]): boolean;
