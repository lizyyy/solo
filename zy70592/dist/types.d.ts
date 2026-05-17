export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    paths: Record<string, PathItem>;
    components?: {
        schemas?: Record<string, Schema>;
    };
}
export interface PathItem {
    get?: Operation;
    post?: Operation;
    put?: Operation;
    patch?: Operation;
    delete?: Operation;
    options?: Operation;
    head?: Operation;
}
export interface Operation {
    summary?: string;
    description?: string;
    operationId?: string;
    responses: Record<string, Response>;
}
export interface Response {
    description: string;
    content?: Record<string, MediaType>;
}
export interface MediaType {
    schema?: Schema;
}
export interface Schema {
    type?: string;
    properties?: Record<string, Schema>;
    required?: string[];
    $ref?: string;
    items?: Schema;
}
export interface ErrorResponseInfo {
    path: string;
    method: string;
    statusCode: string;
    contentType: string;
    schemaFields: string[];
    rawSchema: Schema;
    location: {
        path: string;
        method: string;
        statusCode: string;
    };
}
export interface ConsistencyIssue {
    type: 'field_mismatch' | 'status_code_inconsistent' | 'missing_error_schema';
    severity: 'error' | 'warning' | 'info';
    message: string;
    location: {
        path: string;
        method: string;
        statusCode: string;
    };
    details: {
        expected?: string[];
        actual?: string[];
        suggestion?: string;
    };
}
export interface StatusCodeGroup {
    statusCode: string;
    category: string;
    responses: ErrorResponseInfo[];
    commonFields: string[];
    fieldVariations: Record<string, number>;
}
export interface CheckResult {
    metadata: {
        checkedAt: string;
        inputFile: string;
        totalEndpoints: number;
        totalErrorResponses: number;
    };
    summary: {
        totalIssues: number;
        errors: number;
        warnings: number;
        infos: number;
    };
    statusCodeGroups: StatusCodeGroup[];
    issues: ConsistencyIssue[];
    recommendations: string[];
}
export interface CLIOptions {
    input: string;
    outputDir?: string;
    json?: string;
    markdown?: string;
    targetFields?: string[];
    statusCodes?: string[];
    failOnError?: boolean;
}
