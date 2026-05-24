import { ZoneData, EnvironmentRecord } from '../types';
export declare function analyzeEnvironments(zoneData: ZoneData, targetEnvironments: string[], configPath?: string): EnvironmentRecord[];
export declare function getRecordsByEnvironment(analysis: EnvironmentRecord[], environment: string): EnvironmentRecord[];
export declare function getWildcardRecords(analysis: EnvironmentRecord[]): EnvironmentRecord[];
export declare function getAliasRecords(analysis: EnvironmentRecord[]): EnvironmentRecord[];
export declare function getEnvironmentCounts(analysis: EnvironmentRecord[]): Record<string, number>;
export declare function expandWildcardRecord(wildcardRecord: EnvironmentRecord, allRecords: EnvironmentRecord[]): string[];
