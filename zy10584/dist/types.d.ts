export interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
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
    parameters?: Parameter[];
}
export interface Operation {
    summary?: string;
    description?: string;
    operationId?: string;
    parameters?: Parameter[];
    requestBody?: RequestBody;
    responses: Record<string, Response>;
    tags?: string[];
}
export interface Parameter {
    name: string;
    in: 'query' | 'path' | 'header' | 'cookie';
    description?: string;
    required?: boolean;
    schema?: Schema;
    style?: string;
}
export interface RequestBody {
    description?: string;
    content: Record<string, MediaType>;
    required?: boolean;
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
    items?: Schema;
    $ref?: string;
    description?: string;
    required?: string[];
}
export interface PaginationConfig {
    expectedParams: {
        page: string[];
        pageSize: string[];
    };
    expectedResponseFields: {
        data: string[];
        total: string[];
        page: string[];
        pageSize: string[];
        totalPages?: string[];
    };
    includePaths?: string[];
    excludePaths?: string[];
    httpMethods?: string[];
}
export interface SourceLocation {
    path: string;
    method: string;
    paramName?: string;
    fieldName?: string;
    line?: number;
}
export interface Inconsistency {
    type: 'param_missing' | 'param_name' | 'response_missing' | 'response_name' | 'structure_issue';
    severity: 'error' | 'warning' | 'info';
    message: string;
    location: SourceLocation;
    expected?: string[];
    actual?: string;
    suggestion?: string;
}
export interface EndpointAnalysis {
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    paginationParams: {
        page?: string;
        pageSize?: string;
        allParams: string[];
    };
    responseFields: {
        data?: string;
        total?: string;
        page?: string;
        pageSize?: string;
        totalPages?: string;
        allFields: string[];
    };
    inconsistencies: Inconsistency[];
    isPaginationEndpoint: boolean;
}
export interface CheckResult {
    summary: {
        totalEndpoints: number;
        paginationEndpoints: number;
        inconsistentEndpoints: number;
        totalInconsistencies: number;
        bySeverity: {
            error: number;
            warning: number;
            info: number;
        };
    };
    endpoints: EndpointAnalysis[];
    inconsistencies: Inconsistency[];
    config: PaginationConfig;
    timestamp: string;
    openapiFile: string;
}
