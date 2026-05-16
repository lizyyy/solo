export type SampleType = 'valid' | 'boundary' | 'invalid';
export interface SampleMetadata {
    id: string;
    type: SampleType;
    schemaPath: string;
    fieldPath: string;
    reason: string;
    index: number;
    seed: number;
}
export interface GeneratedSample {
    metadata: SampleMetadata;
    data: unknown;
    validationResult: ValidationResult;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}
export interface ValidationError {
    keyword: string;
    instancePath: string;
    schemaPath: string;
    message: string;
    params: Record<string, unknown>;
}
export interface GeneratorOptions {
    schemaPath: string;
    outputDir: string;
    sampleTypes: SampleType[];
    countPerType: number;
    seed: number;
    fields?: string[];
}
export interface GenerationSummary {
    totalSamples: number;
    validCount: number;
    boundaryCount: number;
    invalidCount: number;
    errors: string[];
    outputPath: string;
    duration: number;
}
export interface ReportData {
    summary: GenerationSummary;
    samples: GeneratedSample[];
    schema: Record<string, unknown>;
    options: GeneratorOptions;
    generatedAt: string;
}
