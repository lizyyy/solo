import { LicenseReport, CliOptions } from './types';
export interface CollectorResult {
    report: LicenseReport;
    exitCode: number;
}
export declare function collectLicenses(options: CliOptions): Promise<CollectorResult>;
