import { BaseGenerator } from './base';
export declare class BoundaryGenerator extends BaseGenerator {
    private boundaries;
    constructor(schema: Record<string, unknown>, seed: number);
    generate(index: number, fieldPath?: string): {
        data: unknown;
        reason: string;
    };
    private setStringBoundary;
    private setMinNumberBoundary;
    private setMaxNumberBoundary;
    private setMinArrayBoundary;
    private setMaxArrayBoundary;
    private setMinStringBoundary;
    private setMaxStringBoundary;
    private getFieldSchema;
}
