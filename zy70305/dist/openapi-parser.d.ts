import { ParsedOpenAPI, ParsedPath, ParsedSchema, HttpMethod, Anomaly } from './types';
export declare class OpenAPIParser {
    private baseDir;
    constructor(baseDir?: string);
    parse(serviceName: string, filePath: string): {
        parsed: ParsedOpenAPI;
        anomalies: Anomaly[];
    };
    private parseOpenAPI;
    private parseParameter;
    private parseRequestBody;
    private parseResponseContent;
    private parseSchema;
    private parseFile;
    resolveSchemaRef(parsed: ParsedOpenAPI, schema: ParsedSchema): ParsedSchema | null;
    flattenSchema(parsed: ParsedOpenAPI, schema: ParsedSchema): ParsedSchema;
    getSchemaForPath(parsed: ParsedOpenAPI, path: string, method: HttpMethod): ParsedPath | undefined;
    getSchemaByOperationId(parsed: ParsedOpenAPI, operationId: string): ParsedPath | undefined;
}
//# sourceMappingURL=openapi-parser.d.ts.map