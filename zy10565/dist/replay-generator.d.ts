import { HttpRequestRecord, ReplayOptions, VariableMap } from './types';
export declare class ReplayGenerator {
    generateCurlCommand(record: HttpRequestRecord, options?: ReplayOptions): string;
    private applyVariableReplacements;
    generateVariableExport(variables: VariableMap): string;
}
