import { ContractDiff, ParsedOpenAPI } from './types';
import { OpenAPIParser } from './openapi-parser';
export declare class ContractDiffEngine {
    private parser;
    constructor(parser: OpenAPIParser);
    compare(serviceName: string, oldSpec: ParsedOpenAPI, newSpec: ParsedOpenAPI): ContractDiff[];
    private createPathMap;
    private comparePaths;
    private compareRequestBody;
    private compareResponses;
    private compareSchemas;
    private createDiff;
}
//# sourceMappingURL=diff-engine.d.ts.map