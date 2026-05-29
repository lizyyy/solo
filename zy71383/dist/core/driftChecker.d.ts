import { ConfigFile, ConfigFormat, DriftReport, EnvironmentName, ImportResult, DiffDetail, QueryOptions, ChangeRecord } from './types';
export declare class DriftCheckerService {
    importConfig(filePath: string, environment: EnvironmentName, format?: ConfigFormat): ImportResult;
    importDefaults(filePath: string): ImportResult;
    importChanges(filePath: string): ImportResult;
    importDirectory(dirPath: string, pattern?: string, envExtractor?: (filename: string) => EnvironmentName): ImportResult;
    checkDrift(baselineEnv: EnvironmentName, targetEnvs?: EnvironmentName[], options?: {
        ignoreArrayOrder?: boolean;
    }): DriftReport;
    queryDiffs(report: DriftReport, options?: QueryOptions): DiffDetail[];
    getManualReviewItems(report: DriftReport): DiffDetail[];
    addChangeRecord(environment: EnvironmentName, key: string, oldValue: unknown, newValue: unknown, author?: string, reason?: string, ticketId?: string): ChangeRecord;
    getChangeHistory(key?: string, environment?: EnvironmentName): ChangeRecord[];
    interpretDiff(diff: DiffDetail): string;
    formatReportSummary(report: DriftReport): string;
    private detectFormat;
    private parseContent;
    private parseEnv;
    clearStore(): void;
    getEnvironments(): EnvironmentName[];
    getConfigDetails(environment: EnvironmentName): ConfigFile | undefined;
}
export declare const driftChecker: DriftCheckerService;
