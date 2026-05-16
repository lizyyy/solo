import { GeneratedSample, GenerationSummary, GeneratorOptions } from '../types';
export declare class Reporter {
    private summary;
    private samples;
    private schema;
    private options;
    constructor(summary: GenerationSummary, samples: GeneratedSample[], schema: Record<string, unknown>, options: GeneratorOptions);
    printConsoleSummary(): void;
    private printOverview;
    private printSampleBreakdown;
    private printValidationStats;
    private printErrors;
    private printOutputInfo;
    exportJsonReport(): string;
    exportHtmlReport(): string;
    private buildHtmlReport;
    private buildSampleCard;
    private escapeHtml;
    private sanitizeForJson;
}
