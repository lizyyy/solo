import { GeneratedSample, GeneratorOptions, GenerationSummary } from '../types';
export declare class SampleGenerator {
    private options;
    private schema;
    private samples;
    private errors;
    private startTime;
    constructor(options: GeneratorOptions);
    private validateSchema;
    generate(): Promise<GenerationSummary>;
    private generateSamplesByType;
    private createGenerator;
    private exportSamples;
    private buildSummary;
    getSamples(): GeneratedSample[];
    getSchema(): Record<string, unknown>;
}
