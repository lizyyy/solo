import { Sample, CountryRule, CheckHistory, CheckResult } from '../types';
export declare class StorageService {
    private dataDir;
    private samplesDir;
    private rulesDir;
    private historyDir;
    private exportDir;
    constructor(dataDir: string);
    private ensureDirectories;
    saveSample(sample: Sample): void;
    getSample(id: string): Sample | null;
    getSampleByName(name: string): Sample | null;
    getAllSamples(): Sample[];
    saveRule(rule: CountryRule): void;
    getRule(countryCode: string): CountryRule | null;
    getAllRules(): CountryRule[];
    saveCheckResult(result: CheckResult): void;
    getHistory(sampleId: string): CheckHistory | null;
    getAllHistory(): CheckHistory[];
    getLastCheckResult(sampleId: string): CheckResult | null;
    exportToJson(data: any, filename: string): string;
    exportToCSV(data: any[], filename: string): string;
    getDataDir(): string;
    getExportDir(): string;
}
