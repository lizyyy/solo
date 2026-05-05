import { ApiLog, ApiLogParseOptions } from '../models';
export declare class ApiLogParser {
    private options;
    constructor(options?: ApiLogParseOptions);
    parse(content: string): ApiLog[];
    private parseJsonFormat;
    private parseJsonItem;
    private parseCsvFormat;
    private parseCsvLine;
    private parsePlainFormat;
    private parsePlainLine;
    private parseMethod;
}
export declare function parseApiLog(content: string, options?: ApiLogParseOptions): ApiLog[];
//# sourceMappingURL=api-log-parser.d.ts.map