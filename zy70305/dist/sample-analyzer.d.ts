import { SampleAnalysis, ContractDiff, ParsedOpenAPI, Anomaly } from './types';
import { OpenAPIParser } from './openapi-parser';
export declare class SampleAnalyzer {
    private parser;
    constructor(parser: OpenAPIParser);
    analyze(serviceName: string, samplesPath: string, oldSpec: ParsedOpenAPI, newSpec: ParsedOpenAPI, diffs: ContractDiff[]): {
        analyses: SampleAnalysis[];
        anomalies: Anomaly[];
    };
    private loadSamples;
    private validateSample;
    private parseFile;
    private resolvePath;
    private checkDeletedFields;
    private checkRemovedEnumValues;
    private hasField;
    private getFieldValues;
    private collectFieldValues;
}
//# sourceMappingURL=sample-analyzer.d.ts.map