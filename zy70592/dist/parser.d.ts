import { OpenAPISpec, ErrorResponseInfo } from './types';
export declare class OpenAPIParser {
    private spec;
    private filePath;
    constructor(filePath: string);
    private loadSpec;
    getSpec(): OpenAPISpec;
    private resolveRef;
    private resolveSchema;
    private extractSchemaFields;
    private isErrorStatusCode;
    extractErrorResponses(): ErrorResponseInfo[];
    getTotalEndpoints(): number;
}
