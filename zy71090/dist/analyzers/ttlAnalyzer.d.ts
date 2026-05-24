import { ZoneData, TTLAnalysis, CLIOptions } from '../types';
export declare function analyzeTTL(zoneData: ZoneData, options: CLIOptions): TTLAnalysis[];
export declare function getTTLDistribution(analysis: TTLAnalysis[]): Record<string, number>;
export declare function getRecordsNeedingAdjustment(analysis: TTLAnalysis[]): TTLAnalysis[];
export declare function getRecordsByTier(analysis: TTLAnalysis[], tier: string): TTLAnalysis[];
