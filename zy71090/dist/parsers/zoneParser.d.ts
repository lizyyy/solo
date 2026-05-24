import { ZoneData, DNSRecord } from '../types';
export declare function parseZoneFile(filePath: string): Promise<ZoneData>;
export declare function validateZoneRecords(records: DNSRecord[], strict?: boolean): {
    errors: string[];
    warnings: string[];
};
export declare function formatTTL(seconds: number): string;
