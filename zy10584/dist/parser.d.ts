import { OpenAPISpec, Schema, PaginationConfig } from './types';
export declare class OpenAPIParser {
    private spec;
    private filePath;
    constructor(filePath: string);
    private loadSpec;
    getSpec(): OpenAPISpec;
    getFilePath(): string;
    resolveRef(ref: string): Schema | null;
    resolveSchema(schema: Schema | undefined): Schema | null;
    getResponseSchema(response: any): Schema | null;
    extractResponseFields(schema: Schema | null): string[];
    extractNestedField(schema: Schema | null, fieldPath: string): string | null;
    static getDefaultConfig(): PaginationConfig;
}
