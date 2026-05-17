import { ScanOptions, ScanResult } from '../types';
export declare class FeatureFlagScanner {
    private flagLoader;
    private codeScanner;
    private reporter;
    constructor();
    scan(options: ScanOptions): Promise<ScanResult>;
    private groupBy;
}
