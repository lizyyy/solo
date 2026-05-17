import { ParseOptions, ParseResult } from './types';
export declare class HttpRecordParser {
    private options;
    constructor(options?: ParseOptions);
    parse(content: string): ParseResult;
    private parseLine;
    private isJsonFormat;
    private isCurlFormat;
    private isRawHttpRequest;
    private parseJsonLine;
    private parseCurlLine;
    private parseRawHttpRequest;
    private parseSimpleFormat;
    private parseUrlComponents;
    private aggregateVariables;
}
