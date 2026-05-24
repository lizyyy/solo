export interface DNSRecord {
    name: string;
    type: string;
    ttl: number;
    value: string;
    comment?: string;
    weight?: number;
    priority?: number;
    setIdentifier?: string;
}
export interface ZoneData {
    name: string;
    records: DNSRecord[];
    origin?: string;
    ttl?: number;
}
export type TTLTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'LEGACY';
export interface TTLTierConfig {
    tier: TTLTier;
    min: number;
    max: number;
    description: string;
    color: string;
}
export interface EnvironmentAlias {
    alias: string;
    environment: string;
    pattern: RegExp;
}
export interface EnvironmentConfig {
    name: string;
    patterns: string[];
    color: string;
}
export interface MigrationWindow {
    start: Date;
    end: Date;
    recommendedTTL: number;
}
export interface TTLAnalysis {
    record: DNSRecord;
    tier: TTLTier;
    tierInfo: TTLTierConfig;
    needsAdjustment: boolean;
    recommendedTTL: number;
    reason: string;
}
export interface EnvironmentRecord {
    record: DNSRecord;
    environments: string[];
    isWildcard: boolean;
    hasAlias: boolean;
}
export interface CNAMEChain {
    domain: string;
    chain: DNSRecord[];
    totalTTL: number;
    maxTTL: number;
    minTTL: number;
    averageTTL: number;
    depth: number;
    isCircular: boolean;
    unresolved: string[];
}
export interface MissingRecord {
    environment: string;
    recordName: string;
    type: string;
    foundInEnvironments: string[];
}
export interface AnalysisResult {
    zone: ZoneData;
    ttlAnalysis: TTLAnalysis[];
    environmentAnalysis: EnvironmentRecord[];
    cnameChains: CNAMEChain[];
    missingRecords: MissingRecord[];
    summary: {
        totalRecords: number;
        byTier: Record<TTLTier, number>;
        byType: Record<string, number>;
        byEnvironment: Record<string, number>;
        needsAdjustment: number;
        cnameChainsCount: number;
        missingRecordsCount: number;
        averageTTL: number;
        maxTTL: number;
        minTTL: number;
    };
}
export interface CLIOptions {
    zoneFile: string;
    zoneDir?: string;
    outputDir: string;
    environments: string[];
    migrationWindow?: string;
    ttlConfig?: string;
    envConfig?: string;
    format: string[];
    verbose: boolean;
    strict: boolean;
    expandCNAME: boolean;
    maxChainDepth: number;
    minTTLWarn: number;
    maxTTLWarn: number;
}
export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 100;
export declare const EXIT_CODES: Record<string, ExitCode>;
export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}
